import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM payments ORDER BY id DESC");
  return NextResponse.json({ payments: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();

  // Insert payment
  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO payments (client_id, amount, payment_method, status, notes) VALUES ($1,$2,$3,'COMPLETED',$4) RETURNING *`,
    [body.clientId, body.amount, body.paymentMethod, body.notes || null]
  );

  // Payment recorded — balance tracking removed
  return NextResponse.json({ payment: result.rows[0] }, { status: 201 });
}
