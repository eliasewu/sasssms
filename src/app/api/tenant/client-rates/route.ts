import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { auditLog } from "@/lib/db-helpers";
import { padMnc, formatMccMnc } from "@/lib/mcc-lookup-client";
import { recordRateChange } from "@/lib/billing-service";

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

  // Capture the previous active rate so we can log/notify on a change (vs. a new add)
  const oldRow = await tenantQuery(
    tenant.schemaName,
    "SELECT id, rate FROM client_rates WHERE client_id = $1 AND country_code = $2 AND is_active = true ORDER BY id DESC LIMIT 1",
    [clientId, countryCode]
  );
  const oldRate = oldRow.rows[0]?.rate ? String(oldRow.rows[0].rate) : "";
  const oldRateId = oldRow.rows[0]?.id ?? null;

  // ── Deactivate any existing active rate for the same destination ──
  // Only one active rate per (client_id, country_code, mcc, mnc) combo.
  // The MNC is compared zero-padded ("3" vs "003" = same network), matching
  // the canonical 3-digit storage format.
  // Fixed parameter positions: $1=clientId, $2=countryCode, $3=mcc, $4=mnc
  const deactMcc = mcc || null;
  const deactMnc = mnc || null;
  await tenantQuery(
    tenant.schemaName,
    `UPDATE client_rates SET is_active = false, updated_at = NOW()
     WHERE client_id = $1 AND country_code = $2
     ${mcc ? `AND mcc = $3` : `AND mcc IS NULL`}
     ${mnc ? `AND LPAD(COALESCE(mnc,''), 3, '0') = LPAD(COALESCE($4,''), 3, '0')` : `AND mnc IS NULL`}
     AND is_active = true`,
    [clientId, countryCode, deactMcc, deactMnc]
  );

  // Store the canonical zero-padded MNC and backfill mccmnc (computed in JS to
  // avoid SQL-side type ambiguity on the shared parameters)
  const mncPadded = padMnc(mnc) || null;
  const mccmnc = mcc ? formatMccMnc(mcc, mnc || "") : null;
  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO client_rates (client_id, country_code, mcc, mnc, operator_name, rate, mccmnc)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [clientId, countryCode, mcc || null, mncPadded, operatorName || null, rate, mccmnc]
  );

  await auditLog("client_rates", result.rows[0].id, "CREATE", tenant.email, undefined, result.rows[0] as Record<string, unknown>, tenant.tenantId);

  // ── Log history + notify admin/client about the rate add/change ──
  await recordRateChange(tenant.schemaName, "client", clientId, {
    rateId: result.rows[0].id,
    oldRateId,
    countryCode,
    mcc,
    mnc,
    operatorName,
    oldRate,
    newRate: String(rate),
    action: "CREATE",
    changedBy: tenant.email,
  });

  return NextResponse.json({ rate: result.rows[0] }, { status: 201 });
}
