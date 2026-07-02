import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { pool } from "@/db";

/** GET — download MCC/MNC database as CSV */
export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const format = url.searchParams.get("format") || "csv";

  const client = await pool.connect();
  try {
    let query = `SELECT mcc, mnc, country_code, country_name, network_name, language FROM mcc_mnc_database`;
    const params: unknown[] = [];

    if (search) {
      query += ` WHERE country_name ILIKE $1 OR mcc ILIKE $1 OR network_name ILIKE $1`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY country_name, network_name`;
    const { rows } = await client.query(query, params);

    // Build CSV
    const header = "mcc,mnc,country_code,country_name,network_name,language\n";
    const csvRows = rows.map((r: { mcc: string; mnc: string | null; country_code: string; country_name: string; network_name: string | null; language: string }) =>
      `${r.mcc},${r.mnc || ""},${r.country_code},"${r.country_name}",${r.network_name || ""},${r.language}`
    ).join("\n");

    const csv = header + csvRows;

    const filename = `mcc_mnc_database_${new Date().toISOString().slice(0, 10)}.${format}`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": format === "csv" ? "text/csv; charset=utf-8" : "text/plain",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("MCC download error:", error);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
