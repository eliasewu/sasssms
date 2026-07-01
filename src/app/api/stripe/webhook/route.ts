import { NextResponse } from "next/server";
import { pool, db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { safeInt } from "@/lib/validation";
import { notifyClientPaymentApproved } from "@/lib/email-service";

// Stripe webhook secret from env
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  // In production, verify the Stripe signature
  // const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  // const event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);

  const body = await request.json();

  // Handle checkout.session.completed event
  if (body.type === "checkout.session.completed") {
    const session = body.data.object;
    const metadata = session.metadata || {};
    const txnId = parseInt(metadata.transaction_id);

    if (!txnId) {
      return NextResponse.json({ error: "No transaction_id in metadata" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      // Update transaction status
      const result = await client.query(
        `UPDATE payment_transactions SET status = 'COMPLETED', transaction_id = $1, approved_at = NOW()
         WHERE id = $2 AND status = 'PENDING_STRIPE' RETURNING *`,
        [session.id || session.payment_intent, txnId]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Transaction not found or already processed" }, { status: 404 });
      }

      const txn = result.rows[0];

      // Add SMS credits to tenant
      const [tenantData] = await db
        .select({
          smsCounter: tenants.smsCounter,
          smsLimit: tenants.smsLimit,
          smsValidUntil: tenants.smsValidUntil,
        })
        .from(tenants)
        .where(eq(tenants.id, txn.tenant_id));

      if (tenantData && txn.sms_amount > 0) {
        const newLimit = safeInt((tenantData.smsLimit || 0) + txn.sms_amount);
        const validUntil = new Date();
        validUntil.setMonth(validUntil.getMonth() + 3);

        await db.update(tenants).set({
          smsLimit: newLimit,
          smsValidUntil: validUntil,
          lastRechargeAt: new Date(),
          lastRechargeAmount: txn.amount,
          updatedAt: new Date(),
        }).where(eq(tenants.id, txn.tenant_id));
      }

      // Send confirmation email
      if (txn.client_email) {
        let meta: Record<string, unknown> = {};
        try { meta = JSON.parse(txn.metadata || "{}"); } catch {}
        notifyClientPaymentApproved({
          clientEmail: txn.client_email,
          clientName: (meta.clientName as string) || "Customer",
          amount: txn.amount,
          paymentMethod: txn.payment_method,
          transactionId: txn.id,
          smsAdded: txn.sms_amount,
        }).catch(() => {});
      }
    } finally {
      client.release();
    }
  }

  return NextResponse.json({ received: true });
}
