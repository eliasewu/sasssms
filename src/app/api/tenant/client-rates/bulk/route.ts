import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { padMnc, formatMccMnc } from "@/lib/mcc-lookup-client";
import { recordBulkRateChange } from "@/lib/billing-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/tenant/client-rates/bulk
 * Bulk-import many operator rates for one client in a single request, and log
 * the whole batch as ONE grouped rate_history entry (instead of one row per
 * operator).
 *
 * Body: {
 *   clientId: number,
 *   country?: string,               // label for the grouped history entry
 *   rate: string|number,
 *   operators: [{ countryCode, mcc?, mnc?, operatorName? }]
 * }
 */
export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { clientId, country, rate, operators } = body;

  if (!clientId || !Array.isArray(operators) || operators.length === 0) {
    return NextResponse.json({ error: "clientId and a non-empty operators array are required" }, { status: 400 });
  }
  if (rate === undefined || rate === null || rate === "") {
    return NextResponse.json({ error: "rate is required" }, { status: 400 });
  }

  const insertedIds: number[] = [];
  let imported = 0;

  for (const op of operators) {
    const countryCode = op?.countryCode ?? null;
    const mcc = op?.mcc ?? null;
    const mnc = op?.mnc ?? null;
    const operatorName = op?.operatorName ?? null;
    if (!countryCode) continue;

    // ── Deactivate any existing active rate for the same destination ──
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

    const mncPadded = padMnc(mnc) || null;
    const mccmnc = mcc ? formatMccMnc(mcc, mnc || "") : null;
    const result = await tenantQuery(
      tenant.schemaName,
      `INSERT INTO client_rates (client_id, country_code, mcc, mnc, operator_name, rate, mccmnc)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [clientId, countryCode, mcc || null, mncPadded, operatorName, rate, mccmnc]
    );

    insertedIds.push(result.rows[0].id);
    imported++;
  }

  if (imported === 0) {
    return NextResponse.json({ error: "No operators with a country code were imported" }, { status: 400 });
  }

  // One grouped history entry + one notification for the whole batch.
  await recordBulkRateChange(tenant.schemaName, "client", clientId, {
    country: country || null,
    rate: String(rate),
    batchCount: imported,
    rateIds: insertedIds,
    changedBy: tenant.email,
  });

  return NextResponse.json({ imported, rateIds: insertedIds }, { status: 201 });
}
