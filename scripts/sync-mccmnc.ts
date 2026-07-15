/**
 * sync-mccmnc.ts — Import MCCMNC.csv into the global mcc_mnc_database table.
 *
 * Reads from /opt/net2app/MCCMNC.csv (or the path passed as first argument).
 * Inserts only new entries using INSERT ... WHERE NOT EXISTS (no N+1 round-trips).
 * Prints a summary line to stdout for the caller to log.
 *
 * Usage: npx tsx scripts/sync-mccmnc.ts [/path/to/MCCMNC.csv]
 */

import { Pool } from "pg";
import fs from "fs";

const CSV_PATH = process.argv[2] || "/opt/net2app/MCCMNC.csv";

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`File not found: ${CSV_PATH}`);
    process.exit(1);
  }

  const csv = fs.readFileSync(CSV_PATH, "utf8");
  const lines = csv.trim().split("\n");
  if (lines.length < 2) {
    console.error("CSV has no data rows");
    process.exit(1);
  }

  const pool = new Pool({
    host: process.env.PGHOST || "127.0.0.1",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres",
    database: process.env.PGDATABASE || "app_db",
  });

  const client = await pool.connect();

  // Ensure the table exists
  await client.query(`
    CREATE TABLE IF NOT EXISTS mcc_mnc_database (
      id SERIAL PRIMARY KEY,
      mcc VARCHAR(10) NOT NULL,
      mnc VARCHAR(10),
      country_code VARCHAR(10) NOT NULL,
      country_name VARCHAR(100) NOT NULL,
      network_name VARCHAR(100),
      network_type VARCHAR(50)
    )
  `);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  // BEGIN before try so ROLLBACK only happens if we actually started a transaction
  await client.query("BEGIN");
  try {
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV with quote handling
      const parts: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; }
        else if (ch === "," && !inQuotes) { parts.push(current.trim()); current = ""; }
        else { current += ch; }
      }
      parts.push(current.trim());

      // MCCMNC.csv format: country,country_code,mcc,mnc,operator,network_type,status
      if (parts.length < 5) continue;

      const countryName = parts[0];
      const countryCode = parts[1];
      const mcc = parts[2];
      const mnc = parts[3] || "";
      const networkName = parts[4];
      const networkType = parts[5] || null;

      if (!mcc || !countryName) continue;

      const mncVal = mnc || null;
      const mncForCompare = mnc || "";
      try {
        const { rowCount } = await client.query(
          `INSERT INTO mcc_mnc_database (mcc, mnc, country_code, country_name, network_name, network_type)
           SELECT $1::varchar, $2, $3, $4, $5, $6
           WHERE NOT EXISTS (
             SELECT 1 FROM mcc_mnc_database
             WHERE mcc = $1::varchar AND COALESCE(mnc, '') = $7
           )`,
          [mcc, mncVal, countryCode, countryName, networkName, networkType, mncForCompare]
        );
        if (rowCount && rowCount > 0) inserted++;
        else skipped++;
      } catch (e) {
        console.error(`Row ${i}: ${(e as Error).message}`);
        errors++;
      }
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Transaction failed:", e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }

  // Summary line (stdout — captured by caller for logging)
  const ts = new Date().toISOString();
  console.log(`[${ts}] MCCMNC sync complete: ${inserted} inserted, ${skipped} skipped, ${errors} errors (total: ${lines.length - 1} rows)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
