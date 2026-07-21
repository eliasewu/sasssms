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

  // ── Deactivate any existing active rate for the same destination ──
  // Only one active rate per (client_id, country_code, mcc, mnc) combo.
  // Fixed parameter positions: $1=clientId, $2=countryCode, $3=mcc, $4=mnc
  const deactMcc = mcc || null;
  const deactMnc = mnc || null;
  await tenantQuery(
    tenant.schemaName,
    `UPDATE client_rates SET is_active = false, updated_at = NOW()
     WHERE client_id = $1 AND country_code = $2
     ${mcc ? `AND mcc = $3` : `AND mcc IS NULL`}
     ${mnc ? `AND mnc = $4` : `AND mnc IS NULL`}
     AND is_active = true`,
    [clientId, countryCode, deactMcc, deactMnc]
  );

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO client_rates (client_id, country_code, mcc, mnc, operator_name, rate) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [clientId, countryCode, mcc || null, mnc || null, operatorName || null, rate]
  );

  await auditLog("client_rates", result.rows[0].id, "CREATE", tenant.email, undefined, result.rows[0] as Record<string, unknown>, tenant.tenantId);

  return NextResponse.json({ rate: result.rows[0] }, { status: 201 });
}
