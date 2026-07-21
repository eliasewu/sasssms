import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { pool } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, amount, status, package_type, sms_amount, created_at
       FROM payment_transactions
       WHERE tenant_id = $1 AND status IN ('PENDING', 'PENDING_CONFIRMATION', 'PENDING_STRIPE')
       ORDER BY id DESC LIMIT 5`,
      [tenant.tenantId]
    );

    const pending = result.rows;
    const count = pending.length;
    const latest = pending.length > 0 ? pending[0] : null;

    return NextResponse.json({
      hasPending: count > 0,
      count,
      latest: latest ? {
        id: latest.id,
        amount: latest.amount,
        status: latest.status,
        packageType: latest.package_type,
        smsAmount: latest.sms_amount,
        createdAt: latest.created_at,
      } : null,
    });
  } finally {
    client.release();
  }
}
