import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { auditLog } from "@/lib/db-helpers";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM client_rates ORDER BY id DESC");
  return NextResponse.json({ rates: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { clientId, countryCode, mcc, mnc, operatorName, rate } = body;

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO client_rates (client_id, country_code, mcc, mnc, operator_name, rate) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [clientId, countryCode, mcc || null, mnc || null, operatorName || null, rate]
  );

  await auditLog("client_rates", result.rows[0].id, "CREATE", tenant.email, undefined, result.rows[0] as Record<string, unknown>, tenant.tenantId);

  return NextResponse.json({ rate: result.rows[0] }, { status: 201 });
}
