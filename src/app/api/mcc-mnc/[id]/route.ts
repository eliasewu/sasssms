import { NextResponse } from "next/server";
import { pool } from "@/db";

// PUT — Update a single MCC/MNC entry
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { mcc, mnc, countryCode, countryName, networkName } = body;

    if (!mcc || !countryName) {
      return NextResponse.json({ error: "MCC and country name required" }, { status: 400 });
    }

    const { rows } = await client.query(
      `UPDATE mcc_mnc_database
       SET mcc = $1, mnc = $2, country_code = $3, country_name = $4, network_name = $5
       WHERE id = $6 RETURNING *`,
      [mcc, mnc || null, countryCode, countryName, networkName || null, parseInt(id)]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error) {
    console.error("MCC/MNC update error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE — Remove a single MCC/MNC entry
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(
      "DELETE FROM mcc_mnc_database WHERE id = $1",
      [parseInt(id)]
    );

    if (rowCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Entry deleted" });
  } catch (error) {
    console.error("MCC/MNC delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
