import { NextResponse } from "next/server";
import { pool } from "@/db";
import { padMnc } from "@/lib/mcc-lookup-client";
import { getSuperAdminFromRequest, getTenantFromRequest } from "@/lib/auth";
import { syncMccMncToTenants } from "@/lib/mcc-mnc-sync";

export async function GET() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT id, mcc, mnc, mccmnc,
              country_code as "countryCode", country_name as "countryName",
              network_name as "networkName"
       FROM mcc_mnc_database ORDER BY country_name, network_name`
    );

    // Cleanup stats — how many duplicate rows the dedup migration (0031)
    // auto-removed, recorded durably in mcc_mnc_cleanup_stats.
    let removed = 0;
    let removedAt: string | null = null;
    try {
      const cleanupResult = await client.query(
        `SELECT removed_count AS removed, removed_at AS "removedAt"
         FROM mcc_mnc_cleanup_stats
         ORDER BY removed_at DESC LIMIT 1`
      );
      if (cleanupResult.rows.length > 0) {
        removed = parseInt(cleanupResult.rows[0].removed, 10);
        removedAt = cleanupResult.rows[0].removedAt || null;
      }
    } catch {
      // Cleanup stats table not present (migration 0032 not applied).
    }

    return NextResponse.json({ data: rows, cleanup: { removed, removedAt } });
  } catch (error) {
    console.error("MCC/MNC query error:", error);
    return NextResponse.json({ data: [] }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  // Tenants and super admins both add entries to the global database (existing
  // behavior), so either session is accepted. Only super-admin changes cascade
  // to every tenant's rate tables — see the sync block below.
  const admin = getSuperAdminFromRequest(request);
  if (!admin && !getTenantFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized — valid tenant or super admin session required" }, { status: 401 });
  }

  const client = await pool.connect();
  try {
    const body = await request.json();
    const { mcc, mnc, countryCode, countryName, networkName } = body;
    
    if (!mcc || !countryName) {
      return NextResponse.json({ error: "MCC and country required" }, { status: 400 });
    }

    // Store the canonical zero-padded MNC ("3" → "003") and dedupe on the
    // padded key, so "3" and "003" are treated as the same network.
    const mncPadded = padMnc(mnc) || null;

    // Check duplicate (mcc + padded mnc)
    const { rows: existing } = await client.query(
      "SELECT id FROM mcc_mnc_database WHERE mcc = $1 AND LPAD(COALESCE(mnc,''), 3, '0') = $2 AND country_code = $3",
      [mcc, padMnc(mnc), countryCode]
    );

    if (existing.length > 0) {
      return NextResponse.json({ data: existing[0], message: "Already exists" });
    }

    const { rows } = await client.query(
      `INSERT INTO mcc_mnc_database (mcc, mnc, country_code, country_name, network_name, mccmnc)
       VALUES ($1::text,$2::text,$3::text,$4::text,$5::text, $1::text || LPAD(COALESCE($2::text,''), 3, '0')) RETURNING *`,
      [mcc, mncPadded, countryCode, countryName, networkName || null]
    );

    // Super-admin additions propagate to all active tenants' shared-default
    // rate rows. (Tenant adds go through /api/tenant/mcc-mnc, which cascades
    // on its own — a tenant hitting this route directly stays global-only.)
    let sync;
    if (admin) {
      sync = await syncMccMncToTenants(
        pool,
        { mcc, mnc: mncPadded, countryCode: countryCode || "", networkName: networkName || null },
        "create"
      );
    }

    return NextResponse.json({ data: rows[0], sync }, { status: 201 });
  } catch (error) {
    console.error("MCC/MNC insert error:", error);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
