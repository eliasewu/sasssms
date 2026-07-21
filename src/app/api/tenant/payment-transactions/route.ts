import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { pool, db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { safeInt, safeDecimal } from "@/lib/validation";
import { notifyAdminNewPayment } from "@/lib/email-service";

// ── Determine initial status based on payment method ──
function getInitialStatus(method: string): string {
  const method_lower = (method || "").toLowerCase();
  // Crypto and manual payments require admin approval
  if (["usdt_trc20", "usdt", "btc", "bnb", "usdc", "eth", "crypto", "bitcoin", "tether"].includes(method_lower)) {
    return "PENDING_CONFIRMATION"; // Manual admin approval required
  }
  return "PENDING";
}

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT * FROM payment_transactions WHERE tenant_id = $1 ORDER BY id DESC LIMIT 50",
      [tenant.tenantId]
    );
    return NextResponse.json({ transactions: result.rows });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { amount, paymentMethod, gatewayId, packageType, smsAmount, transactionId, proofUrl } = body;
  const safeAmount = safeDecimal(amount, "0");
  const safeSmsAmount = safeInt(smsAmount, 0);

  const initialStatus = getInitialStatus(paymentMethod || "");

  const client = await pool.connect();
  try {
    // Insert transaction with PENDING status
    const txnResult = await client.query(
      `INSERT INTO payment_transactions (tenant_id, amount, payment_method, status, package_type, sms_amount, metadata, transaction_id, client_email)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        tenant.tenantId,
        safeAmount,
        paymentMethod || "unknown",
        initialStatus,
        packageType || null,
        safeSmsAmount,
        JSON.stringify({ gatewayId, clientEmail: tenant.email, clientName: tenant.companyName, proofUrl: proofUrl || null }),
        transactionId || null,
        tenant.email,
      ]
    );

    const transaction = txnResult.rows[0];

    // Crypto payment stays PENDING_CONFIRMATION until admin approves
    // No SMS credits are added until approval

    // Send email notification to super admin
    notifyAdminNewPayment({
      tenantName: tenant.companyName,
      tenantEmail: tenant.email,
      amount: safeAmount,
      paymentMethod: paymentMethod || "unknown",
      transactionId: transaction.id,
    }).catch(() => {}); // non-blocking

    return NextResponse.json({
      transaction,
      success: true,
      status: initialStatus,
      message: initialStatus === "PENDING_CONFIRMATION"
        ? "Payment submitted. Awaiting admin confirmation."
        : "Payment submitted for review.",
    }, { status: 201 });
  } finally {
    client.release();
  }
}
