import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { pool } from "@/db";

/** POST — copy all global MCC/MNC entries into tenant's rate tables */
export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { targetTable, entityId, defaultRate } = body;

  if (!targetTable || !entityId || !defaultRate) {
    return NextResponse.json({ error: "targetTable, entityId, and defaultRate required" }, { status: 400 });
  }

  if (targetTable !== "client_rates" && targetTable !== "supplier_rates") {
    return NextResponse.json({ error: "targetTable must be client_rates or supplier_rates" }, { status: 400 });
  }

  const entityColumn = targetTable === "client_rates" ? "client_id" : "supplier_id";
  const valueColumn = targetTable === "client_rates" ? "rate" : "cost";

  const client = await pool.connect();
  try {
    // Fetch all entries from global MCC/MNC database
    const { rows: globalEntries } = await client.query(
      "SELECT mcc, mnc, country_code, country_name, network_name FROM mcc_mnc_database ORDER BY country_name, network_name"
    );

    if (globalEntries.length === 0) {
      return NextResponse.json({ error: "Global MCC/MNC database is empty" }, { status: 400 });
    }

    // Build set of existing entries to skip
    const existingResult = await tenantQuery(
      tenant.schemaName,
      `SELECT mcc, mnc FROM ${targetTable} WHERE ${entityColumn} = $1`,
      [parseInt(entityId)]
    );
    const existingSet = new Set(
      existingResult.rows.map((r: { mcc: string; mnc: string }) => `${r.mcc}|${r.mnc || ""}`)
    );

    // Filter to only new entries
    const newEntries = globalEntries.filter(
      (e: { mcc: string; mnc: string | null }) => !existingSet.has(`${e.mcc}|${e.mnc || ""}`)
    );

    let inserted = 0;
    const batchSize = 100;

    // Multi-row INSERT per batch for speed
    for (let i = 0; i < newEntries.length; i += batchSize) {
      const batch = newEntries.slice(i, i + batchSize);

      const valuesClauses: string[] = [];
      const params: unknown[] = [];
      let paramIdx = 1;

      for (const entry of batch) {
        valuesClauses.push(`($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, true)`);
        params.push(parseInt(entityId), entry.country_code, entry.mcc, entry.mnc || null, defaultRate);
        paramIdx += 5;
      }

      await tenantQuery(
        tenant.schemaName,
        `INSERT INTO ${targetTable} (${entityColumn}, country_code, mcc, mnc, ${valueColumn}, is_active) VALUES ${valuesClauses.join(", ")}`,
        params
      );
      inserted += batch.length;
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped: globalEntries.length - newEntries.length,
      totalInDatabase: globalEntries.length,
      message: `Imported ${inserted} rates (${globalEntries.length - newEntries.length} already existed) into ${targetTable}`,
    });
  } catch (error) {
    console.error("MCC import error:", error);
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
