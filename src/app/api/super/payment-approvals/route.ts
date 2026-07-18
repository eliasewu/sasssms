import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { pool, db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { safeInt } from "@/lib/validation";
import { notifyClientPaymentApproved, notifyClientPaymentRejected } from "@/lib/email-service";
import { computeFirstPaymentBonus } from "@/lib/payment-service";

export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "PENDING_CONFIRMATION";

  const client = await pool.connect();
  try {
    // Handle "all pending" view — includes PENDING, PENDING_CONFIRMATION, PENDING_STRIPE
    let query: string;
    let params: string[];
    if (status === "ALL_PENDING") {
      query = `SELECT pt.*, t.company_name, t.email as tenant_email
       FROM payment_transactions pt
       LEFT JOIN tenants t ON pt.tenant_id = t.id
       WHERE pt.status IN ('PENDING','PENDING_CONFIRMATION','PENDING_STRIPE')
       ORDER BY pt.id DESC LIMIT 100`;
      params = [];
    } else {
      query = `SELECT pt.*, t.company_name, t.email as tenant_email
       FROM payment_transactions pt
       LEFT JOIN tenants t ON pt.tenant_id = t.id
       WHERE pt.status = $1
       ORDER BY pt.id DESC LIMIT 100`;
      params = [status];
    }
    const result = await client.query(query, params);
    return NextResponse.json({ transactions: result.rows });
  } finally {
    client.release();
  }
}

// Approve or reject a payment
export async function PUT(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { transactionId, action, reason } = body; // action: "approve" | "reject"

  if (!transactionId || !action) {
    return NextResponse.json({ error: "transactionId and action required" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    // Get transaction
    const txnResult = await client.query(
      "SELECT * FROM payment_transactions WHERE id = $1",
      [transactionId]
    );
    if (txnResult.rows.length === 0) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    const txn = txnResult.rows[0];

    if (txn.status === "COMPLETED" || txn.status === "REJECTED") {
      return NextResponse.json({ error: `Transaction already ${txn.status}` }, { status: 400 });
    }

    if (action === "approve") {
      // Update transaction status
      await client.query(
        `UPDATE payment_transactions SET status = 'COMPLETED', approved_by = $1, approved_at = NOW()
         WHERE id = $2`,
        [admin.adminId, transactionId]
      );

      // Add SMS credits to tenant
      const [tenantData] = await db
        .select({
          smsCounter: tenants.smsCounter,
          smsLimit: tenants.smsLimit,
          smsValidUntil: tenants.smsValidUntil,
          packageType: tenants.packageType,
        })
        .from(tenants)
        .where(eq(tenants.id, txn.tenant_id));

      // Handle package upgrade or SMS top-up based on transaction package_type
      const pkgType = (txn.package_type || "").toLowerCase();
      const isPackagePurchase = pkgType === "professional" || pkgType === "enterprise";
      const isStarterRecharge = pkgType === "starter" || (!pkgType && tenantData?.packageType === "starter");

      // Package pricing (synced with packages table & landing page)
      const PRO_MONTHLY_FEE = "150";
      const ENT_MONTHLY_FEE = "399";
      const PRO_SMS_CREDITS = 10_000_000;

      // First-payment promo bonus (computed once, used for limit + email)
      let smsWithBonus: number | null = null;

      if (tenantData) {
        // ── Package upgrade: Professional or Enterprise ──
        if (isPackagePurchase) {
          const monthlyFee = pkgType === "professional" ? PRO_MONTHLY_FEE : ENT_MONTHLY_FEE;
          const smsCredits = pkgType === "professional" ? PRO_SMS_CREDITS : 0; // 0 = unlimited (Enterprise)
          const currentLimit = safeInt(tenantData.smsLimit || 0);
          const newLimit = smsCredits > 0 ? currentLimit + smsCredits : 0;

          // Package expires in 1 month
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
        // ── Starter recharge: 6-month validity with carry-forward (first-payment +100k bonus) ──
        else if (isStarterRecharge && txn.sms_amount > 0) {
          const currentLimit = safeInt(tenantData.smsLimit || 0);
          const bonus = await computeFirstPaymentBonus(txn.tenant_id, txn.amount, txn.sms_amount);
          smsWithBonus = bonus.totalSms;
          const newLimit = currentLimit + smsWithBonus;

          // 6-month validity: extend from now or carry forward if still valid
          let validUntil: Date;
          if (tenantData.smsValidUntil && new Date(tenantData.smsValidUntil) > new Date()) {
            // Still valid — extend from today by 6 months (carry forward remaining)
            validUntil = new Date();
            validUntil.setMonth(validUntil.getMonth() + 6);
          } else {
            // Expired or no existing validity — fresh 6 months
            validUntil = new Date();
            validUntil.setMonth(validUntil.getMonth() + 6);
          }

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
          const currentLimit = safeInt(tenantData.smsLimit || 0);
          const bonus = await computeFirstPaymentBonus(txn.tenant_id, txn.amount, txn.sms_amount);
          smsWithBonus = bonus.totalSms;
          const newLimit = currentLimit + smsWithBonus;

          let validUntil: Date;
          if (tenantData.smsValidUntil && new Date(tenantData.smsValidUntil) > new Date()) {
            validUntil = new Date();
            validUntil.setMonth(validUntil.getMonth() + 6);
          } else {
            validUntil = new Date();
            validUntil.setMonth(validUntil.getMonth() + 6);
          }

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

      return NextResponse.json({ success: true, status: "COMPLETED", message: "Payment approved and credits added." });
    }

    if (action === "reject") {
      await client.query(
        `UPDATE payment_transactions SET status = 'REJECTED', notes = $1, approved_by = $2, approved_at = NOW()
         WHERE id = $3`,
        [reason || "Payment rejected by admin", admin.adminId, transactionId]
      );

      // Notify client of rejection
      if (txn.client_email) {
        let meta: Record<string, unknown> = {};
        try { meta = JSON.parse(txn.metadata || "{}"); } catch {}
        notifyClientPaymentRejected({
          clientEmail: txn.client_email,
          clientName: (meta.clientName as string) || "Customer",
          amount: txn.amount,
          paymentMethod: txn.payment_method,
          reason,
        }).catch(() => {});
      }

      return NextResponse.json({ success: true, status: "REJECTED", message: "Payment rejected." });
    }

    return NextResponse.json({ error: "Invalid action. Use 'approve' or 'reject'" }, { status: 400 });
  } finally {
    client.release();
  }
}
