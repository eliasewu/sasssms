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

  // ── Deactivate any existing active rate for the same destination ──
  // Only one active rate per (supplier_id, country_code, mcc, mnc) combo.
  // Fixed parameter positions: $1=supplierId, $2=countryCode, $3=mcc, $4=mnc
  const deactMcc = mcc || null;
  const deactMnc = mnc || null;
  await tenantQuery(
    tenant.schemaName,
    `UPDATE supplier_rates SET is_active = false, updated_at = NOW()
     WHERE supplier_id = $1 AND country_code = $2
     ${mcc ? `AND mcc = $3` : `AND mcc IS NULL`}
     ${mnc ? `AND mnc = $4` : `AND mnc IS NULL`}
     AND is_active = true`,
    [supplierId, countryCode, deactMcc, deactMnc]
  );

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO supplier_rates (supplier_id, country_code, mcc, mnc, operator_name, cost) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [supplierId, countryCode, mcc || null, mnc || null, operatorName || null, cost]
  );

  await auditLog("supplier_rates", result.rows[0].id, "CREATE", tenant.email, undefined, result.rows[0] as Record<string, unknown>, tenant.tenantId);

  return NextResponse.json({ rate: result.rows[0] }, { status: 201 });
}
