import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { auditLog } from "@/lib/db-helpers";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM supplier_rates ORDER BY id DESC");
  return NextResponse.json({ rates: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { supplierId, countryCode, mcc, mnc, operatorName, cost } = body;

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO supplier_rates (supplier_id, country_code, mcc, mnc, operator_name, cost) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [supplierId, countryCode, mcc || null, mnc || null, operatorName || null, cost]
  );

  await auditLog("supplier_rates", result.rows[0].id, "CREATE", tenant.email, undefined, result.rows[0] as Record<string, unknown>, tenant.tenantId);

  return NextResponse.json({ rate: result.rows[0] }, { status: 201 });
}
