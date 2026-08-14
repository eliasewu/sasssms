/**
 * resync-mccmnc-tenants.ts — Re-propagate the FULL global mcc_mnc_database into
 * every active tenant's shared-default rate rows (client_rates client_id=-1 /
 * supplier_rates supplier_id=-1).
 *
 * sync-mccmnc.ts only propagates entries that were NEWLY inserted in that run.
 * If a previous run was interrupted mid-propagation (or a tenant was created
 * after the import), some tenants end up with partial shared-default coverage.
 * This script replays the whole table with action="create" (INSERT … WHERE NOT
 * EXISTS), which is idempotent and fills in whatever is missing.
 *
 * Usage: npx tsx scripts/resync-mccmnc-tenants.ts
 */

import { Pool } from "pg";
import { syncMccMncToTenants } from "../src/lib/mcc-mnc-sync";

async function main() {
  const pool = new Pool({
    host: process.env.PGHOST || "127.0.0.1",
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres",
    database: process.env.PGDATABASE || "app_db",
  });

  const client = await pool.connect();
  const { rows } = await client.query(
    "SELECT mcc, mnc, country_code, network_name FROM mcc_mnc_database ORDER BY id"
  );
  client.release();

  let tenantCount = 0;
  let failed = 0;
  for (const row of rows) {
    const stats = await syncMccMncToTenants(pool, {
      mcc: row.mcc as string,
      mnc: row.mnc as string | null,
      countryCode: row.country_code as string,
      networkName: row.network_name as string | null,
    }, "create");
    tenantCount = Math.max(tenantCount, stats.tenants);
    failed += stats.failed;
  }

  await pool.end();
  console.log(
    `[${new Date().toISOString()}] resync complete: ${rows.length} entries re-propagated ` +
    `to ${tenantCount} tenants (${failed} tenant failures)`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
