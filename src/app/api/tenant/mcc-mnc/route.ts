import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { pool } from "@/db";

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
    return NextResponse.json({ data: rows, total });
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

    // Check duplicate
    const { rows: existing } = await client.query(
      "SELECT id FROM mcc_mnc_database WHERE mcc = $1 AND COALESCE(mnc,'') = $2 AND country_code = $3",
      [mcc, mnc || "", countryCode]
    );

    if (existing.length > 0) {
      return NextResponse.json({ data: existing[0], message: "Already exists" });
    }

    const { rows } = await client.query(
      `INSERT INTO mcc_mnc_database (mcc, mnc, country_code, country_name, network_name, language, mccmnc)
       VALUES ($1,$2,$3,$4,$5,$6, $1 || LPAD(COALESCE($2,''), 3, '0')) RETURNING *`,
      [mcc, mnc || null, countryCode, countryName, networkName || null, language || "English"]
    );

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("MCC/MNC insert error:", error);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
