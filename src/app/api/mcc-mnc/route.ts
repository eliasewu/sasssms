import { NextResponse } from "next/server";
import { pool } from "@/db";

export async function GET() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT id, mcc, mnc, country_code as \"countryCode\", country_name as \"countryName\", network_name as \"networkName\" FROM mcc_mnc_database ORDER BY country_name, network_name"
    );
    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("MCC/MNC query error:", error);
    return NextResponse.json({ data: [] }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function POST(request: Request) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { mcc, mnc, countryCode, countryName, networkName } = body;
    
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
      `INSERT INTO mcc_mnc_database (mcc, mnc, country_code, country_name, network_name)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [mcc, mnc || null, countryCode, countryName, networkName || null]
    );

    return NextResponse.json({ data: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("MCC/MNC insert error:", error);
    return NextResponse.json({ error: "Insert failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
