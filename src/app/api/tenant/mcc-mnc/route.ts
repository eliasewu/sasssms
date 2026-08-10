import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { pool } from "@/db";
import { padMnc, isValidMccMnc } from "@/lib/mcc-lookup-client";
import { syncMccMncToTenants } from "@/lib/mcc-mnc-sync";

/** GET — fetch global MCC/MNC database (filtered by search) */
export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const limit = parseInt(url.searchParams.get("limit") || "500");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const client = await pool.connect();
  try {
    let query = `SELECT id, mcc, mnc, mccmnc,
                        country_code as "countryCode", country_name as "countryName",
                        network_name as "networkName", language
                 FROM mcc_mnc_database`;
    const params: unknown[] = [];

    if (search) {
      query += ` WHERE country_name ILIKE $1 OR mcc ILIKE $1 OR network_name ILIKE $1`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY country_name, network_name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const countQuery = search
      ? `SELECT COUNT(*) as total FROM mcc_mnc_database WHERE country_name ILIKE $1 OR mcc ILIKE $1 OR network_name ILIKE $1`
      : `SELECT COUNT(*) as total FROM mcc_mnc_database`;
    
    const countParams = search ? [`%${search}%`] : [];
    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0]?.total || "0");

    const { rows } = await client.query(query, params);

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

    return NextResponse.json({ data: rows, total, cleanup: { removed, removedAt } });
  } catch (error) {
    console.error("MCC/MNC query error:", error);
    return NextResponse.json({ data: [], total: 0 }, { status: 500 });
  } finally {
    client.release();
  }
}

/** POST — add a single entry to global MCC/MNC database (from tenant dashboard) */
export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await pool.connect();
  try {
    const body = await request.json();
    const { mcc, mnc, countryCode, countryName, networkName, language } = body;

    if (!mcc || !countryName) {
      return NextResponse.json({ error: "MCC and country required" }, { status: 400 });
    }

    // Tenant adds now cascade into every tenant's rate tables, so reject
    // malformed keys (MCC 2-3 digits, MNC 1-3 digits) up front.
    if (!isValidMccMnc(mcc, mnc)) {
      return NextResponse.json({ error: "Invalid MCC/MNC format (MCC: 2-3 digits, MNC: 1-3 digits)" }, { status: 400 });
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
      `INSERT INTO mcc_mnc_database (mcc, mnc, country_code, country_name, network_name, language, mccmnc)
       VALUES ($1::text,$2::text,$3::text,$4::text,$5::text,$6::text, $1::text || LPAD(COALESCE($2::text,''), 3, '0')) RETURNING *`,
      [mcc, mncPadded, countryCode, countryName, networkName || null, language || "English"]
    );

    // New global entries are also propagated to every active tenant's
    // shared-default rate rows (client_id=-1 / supplier_id=-1).
    const sync = await syncMccMncToTenants(
      pool,
      { mcc, mnc: mncPadded, countryCode: countryCode || "", networkName: networkName || null },
      "create"
    );

    return NextResponse.json({ data: rows[0], sync }, { status: 201 });
  } catch (error) {
    console.error("MCC/MNC insert error:", error);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
