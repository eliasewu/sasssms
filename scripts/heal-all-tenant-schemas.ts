/**
 * One-off heal: reconcile ALL existing tenant schemas against the current
 * TENANT_TABLE_DEFS (single source of truth) and ALTER any missing columns.
 *
 * This is the same reconciliation the self-healing createTenantSchema runs on
 * every touch — run it once to heal every existing schema immediately instead
 * of waiting for each tenant to be touched (login / registration sync).
 *
 * Run: npx tsx scripts/heal-all-tenant-schemas.ts
 */
import { pool } from "@/db";
import { TENANT_TABLE_DEFS, extractColumnDefs } from "@/lib/tenant-schema";

async function main() {
  const client = await pool.connect();
  try {
    const expected = extractColumnDefs(TENANT_TABLE_DEFS);
    const { rows: tenants } = await client.query(
      "SELECT schema_name FROM tenants WHERE is_active = true ORDER BY id"
    );

    console.log(`Healing ${tenants.length} active tenant schemas...\n`);
    let totalAdded = 0;
    let totalFailed = 0;

    for (const t of tenants) {
      const schema = t.schema_name as string;
      if (!/^[a-z0-9_]+$/.test(schema)) {
        console.log(`[HEAL] SKIP ${schema} (unsafe schema name)`);
        continue;
      }
      for (const [table, defs] of Object.entries(expected)) {
        // If the table is missing entirely, create it from the bootstrap DDL
        // (old schemas predate tables added later — e.g. dlr_webhook_logs).
        const { rows: tblExists } = await client.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
          [schema, table]
        );
        if (tblExists.length === 0) {
          const def = TENANT_TABLE_DEFS.find((d) => d.table === table);
          if (def) {
            try {
              await client.query(def.sql.replace(/^CREATE TABLE IF NOT EXISTS\s+(\S+)/, `CREATE TABLE IF NOT EXISTS "${schema}".$1`));
              console.log(`[HEAL] ${schema}.${table} table created`);
              totalAdded++;
            } catch (e) {
              console.error(`[HEAL] ${schema}.${table} table CREATE FAILED:`, (e as Error).message);
              totalFailed++;
            }
          }
          continue;
        }
        let existing: Set<string>;
        try {
          const res = await client.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
            [schema, table]
          );
          existing = new Set(res.rows.map((r) => r.column_name));
        } catch {
          continue; // table doesn't exist in this schema — skip
        }
        for (const def of defs) {
          const colName = def.split(/\s+/)[0];
          if (existing.has(colName)) continue;
          try {
            await client.query(
              `ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS ${def}`
            );
            console.log(`[HEAL] ${schema}.${table}.${colName} added`);
            totalAdded++;
          } catch (e) {
            console.error(`[HEAL] ${schema}.${table}.${colName} FAILED:`, (e as Error).message);
            totalFailed++;
          }
        }
      }
    }

    console.log(`\nDone: ${totalAdded} columns added, ${totalFailed} failed.`);
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
