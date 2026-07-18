import { NextResponse } from "next/server";
import { pool, db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { safeInt } from "@/lib/validation";
import { notifyClientPaymentApproved } from "@/lib/email-service";
import { computeFirstPaymentBonus } from "@/lib/payment-service";

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
      // Fetch transaction first (before status update) to get data for bonus check
      const txnFetch = await client.query(
        "SELECT * FROM payment_transactions WHERE id = $1 AND status = 'PENDING_STRIPE'",
        [txnId]
      );
      if (txnFetch.rows.length === 0) {
        return NextResponse.json({ error: "Transaction not found or already processed" }, { status: 404 });
      }
      const txnPre = txnFetch.rows[0];

      // ── Compute first-payment bonus BEFORE marking transaction COMPLETED ──
      let smsWithBonus: number | null = null;
      if ((txnPre.package_type === "starter" || !txnPre.package_type) && txnPre.sms_amount > 0) {
        const bonus = await computeFirstPaymentBonus(txnPre.tenant_id, txnPre.amount, txnPre.sms_amount);
        smsWithBonus = bonus.totalSms;
      }

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

      // Add SMS credits and handle package upgrades
      const [tenantData] = await db
        .select({
          smsCounter: tenants.smsCounter,
          smsLimit: tenants.smsLimit,
          smsValidUntil: tenants.smsValidUntil,
          packageType: tenants.packageType,
        })
        .from(tenants)
        .where(eq(tenants.id, txn.tenant_id));

      if (tenantData) {
        const pkgType = (txn.package_type || "").toLowerCase();
        const isPackagePurchase = pkgType === "professional" || pkgType === "enterprise";
        const isStarterRecharge = pkgType === "starter" || (!pkgType && tenantData.packageType === "starter");

        // Package pricing (synced with packages table & landing page)
        const PRO_MONTHLY_FEE = "150";
        const ENT_MONTHLY_FEE = "399";
        const PRO_SMS_CREDITS = 10_000_000;

        // ── Package upgrade: Professional or Enterprise ──
        if (isPackagePurchase) {
          const monthlyFee = pkgType === "professional" ? PRO_MONTHLY_FEE : ENT_MONTHLY_FEE;
          const smsCredits = pkgType === "professional" ? PRO_SMS_CREDITS : 0;
          const currentLimit = safeInt(tenantData.smsLimit || 0);
          const newLimit = smsCredits > 0 ? currentLimit + smsCredits : 0;

          const packageExpiry = new Date();
          packageExpiry.setMonth(packageExpiry.getMonth() + 1);

          await db.update(tenants).set({
            packageType: pkgType,
            monthlyFee: monthlyFee,
            smsLimit: newLimit,
            packageExpiresAt: packageExpiry,
            lastRechargeAt: new Date(),
            lastRechargeAmount: txn.amount,
            updatedAt: new Date(),
          }).where(eq(tenants.id, txn.tenant_id));
        }
        // ── Starter recharge: 6-month validity (first-payment +100k bonus) ──
        else if (isStarterRecharge && txn.sms_amount > 0) {
          const newLimit = safeInt((tenantData.smsLimit || 0) + (smsWithBonus ?? txn.sms_amount));
          const validUntil = new Date();
          validUntil.setMonth(validUntil.getMonth() + 6);

          await db.update(tenants).set({
            smsLimit: newLimit,
            smsValidUntil: validUntil,
            lastRechargeAt: new Date(),
            lastRechargeAmount: txn.amount,
            updatedAt: new Date(),
          }).where(eq(tenants.id, txn.tenant_id));
        }
        // ── Fallback: generic SMS top-up (first-payment +100k bonus) ──
        else if (txn.sms_amount > 0) {
          const newLimit = safeInt((tenantData.smsLimit || 0) + (smsWithBonus ?? txn.sms_amount));
          const validUntil = new Date();
          validUntil.setMonth(validUntil.getMonth() + 6);

          await db.update(tenants).set({
            smsLimit: newLimit,
            smsValidUntil: validUntil,
            lastRechargeAt: new Date(),
            lastRechargeAmount: txn.amount,
            updatedAt: new Date(),
          }).where(eq(tenants.id, txn.tenant_id));
        }
      }

      // Send confirmation email (bonus included only if actually applied)
      if (txn.client_email) {
        let meta: Record<string, unknown> = {};
        try { meta = JSON.parse(txn.metadata || "{}"); } catch {}
        notifyClientPaymentApproved({
          clientEmail: txn.client_email,
          clientName: (meta.clientName as string) || "Customer",
          amount: txn.amount,
          paymentMethod: txn.payment_method,
          transactionId: txn.id,
          smsAdded: smsWithBonus ?? txn.sms_amount,
        }).catch(() => {});
      }
    } finally {
      client.release();
    }
  }

  return NextResponse.json({ received: true });
}
