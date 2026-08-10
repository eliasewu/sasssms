/**
 * sync-mccmnc.ts — Import MCCMNC.csv into the global mcc_mnc_database table.
 *
 * Reads from /opt/net2app/MCCMNC.csv (or the path passed as first argument).
 * Inserts only new entries using INSERT ... WHERE NOT EXISTS (no N+1 round-trips).
 * Prints a summary line to stdout for the caller to log.
 *
 * MNC handling: the CSV stores 1-2 digit MNCs (e.g. "3"), but the database
 * stores the canonical zero-padded 3-digit form ("003") — see migration 0016.
 * MNC is padded BEFORE the duplicate check and INSERT, so re-syncing the same
 * CSV never creates duplicate (mcc, mnc) rows.
 *
 * Usage: npx tsx scripts/sync-mccmnc.ts [/path/to/MCCMNC.csv]
 */

import { Pool } from "pg";
import fs from "fs";
import { syncMccMncToTenants } from "../src/lib/mcc-mnc-sync";

const CSV_PATH = process.argv[2] || "/opt/net2app/MCCMNC.csv";

/** Zero-pad an MNC to 3 digits ("3" → "003"), matching DB canonical form. */
function padMnc(mnc: string | null | undefined): string {
  if (!mnc) return "";
  return mnc.padStart(3, "0");
}

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
  let syncTenants = 0;
  let syncFailed = 0;
  // Newly inserted rows — propagated to every active tenant after the import
  // commits, so the nightly CSV sync also reaches existing tenants' rates.
  const newEntries: { mcc: string; mncPadded: string | null; countryCode: string; networkName: string | null }[] = [];

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

      // Store the canonical zero-padded MNC and dedupe on the padded key,
      // so "3" and "003" are treated as the same network.
      const mncPadded = padMnc(mnc) || null;
      try {
        const { rowCount } = await client.query(
          `INSERT INTO mcc_mnc_database (mcc, mnc, country_code, country_name, network_name, network_type, mccmnc)
           SELECT $1::varchar, $2::varchar, $3, $4, $5, $6, $1::varchar || $7
           WHERE NOT EXISTS (
             SELECT 1 FROM mcc_mnc_database
             WHERE mcc = $1::varchar AND LPAD(COALESCE(mnc, ''), 3, '0') = $7
           )`,
          [mcc, mncPadded, countryCode, countryName, networkName, networkType, padMnc(mnc)]
        );
        if (rowCount && rowCount > 0) {
          inserted++;
          newEntries.push({ mcc, mncPadded, countryCode, networkName: networkName || null });
        } else skipped++;
      } catch (e) {
        console.error(`Row ${i}: ${(e as Error).message}`);
        errors++;
      }
    }

    await client.query("COMMIT");

    // Propagate the newly inserted entries to all active tenants' shared-default
    // rate rows (client_id=-1 / supplier_id=-1). Uses this script's own pool.
    try {
      for (const entry of newEntries) {
        const stats = await syncMccMncToTenants(
          pool,
          { mcc: entry.mcc, mnc: entry.mncPadded, countryCode: entry.countryCode, networkName: entry.networkName },
          "create"
        );
        syncTenants = Math.max(syncTenants, stats.tenants);
        syncFailed += stats.failed;
      }
    } catch (e) {
      console.error(`Tenant sync failed: ${(e as Error).message}`);
    }
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
  console.log(
    `[${ts}] MCCMNC sync complete: ${inserted} inserted, ${skipped} skipped, ${errors} errors ` +
    `(total: ${lines.length - 1} rows); ${newEntries.length} entries synced to ${syncTenants} tenants (${syncFailed} tenant failures)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
