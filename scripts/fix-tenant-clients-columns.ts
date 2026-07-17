/**
 * Fix: Add missing columns to all existing tenant clients tables.
 * This ensures route_plan_id and other recent columns exist in all schemas.
 * Run: npx tsx scripts/fix-tenant-clients-columns.ts
 */
import { pool } from "@/db";

async function main() {
  const c = await pool.connect();
  try {
    // Get all active tenant schemas
    const { rows: tenantRows } = await c.query(
      "SELECT id, company_name, schema_name FROM tenants WHERE is_active = true ORDER BY id"
    );

    console.log(`Checking ${tenantRows.length} active tenants for missing columns...\n`);

    // Required columns that should exist on every tenant's clients table
    const requiredCols = [
      { name: "route_plan_id", type: "INTEGER" },
      { name: "deleted_at", type: "TIMESTAMP" },
      { name: "deleted_by", type: "VARCHAR(255)" },
      { name: "bind_status", type: "VARCHAR(20) DEFAULT 'UNBOUND'" },
      { name: "last_bind_time", type: "TIMESTAMP" },
      { name: "dlr_callback_url", type: "TEXT" },
      { name: "webhook_url", type: "TEXT" },
      { name: "force_dlr", type: "BOOLEAN DEFAULT false" },
      { name: "dlr_timeout_mode", type: "VARCHAR(50)" },
      { name: "dlr_timeout", type: "INTEGER" },
      { name: "enable_http_api", type: "BOOLEAN DEFAULT false" },
      { name: "http_api_key", type: "VARCHAR(255)" },
    ];

    let totalAdded = 0;
    let totalSkips = 0;

    for (const t of tenantRows) {
      const schema = t.schema_name;
      if (!/^[a-z0-9_]+$/.test(schema)) {
        console.log(`  ⚠️  Skipping ${t.company_name}: invalid schema name`);
        continue;
      }

      try {
        for (const col of requiredCols) {
          // Check if column exists
          const { rows: colRows } = await c.query(
            `SELECT 1 FROM information_schema.columns 
             WHERE table_schema = $1 AND table_name = 'clients' AND column_name = $2`,
            [schema, col.name]
          );

          if (colRows.length === 0) {
            // Column missing — add it
            await c.query(
              `ALTER TABLE "${schema}".clients ADD COLUMN IF NOT EXISTS "${col.name}" ${col.type}`
            );
            console.log(`  ✅ ${t.company_name}: added ${col.name}`);
            totalAdded++;
          } else {
            totalSkips++;
          }
        }
      } catch (err: any) {
        console.error(`  ❌ ${t.company_name} (${schema}): skipped — ${err.message}`);
      }
    }

    console.log(`\n🎉 Done! Added ${totalAdded} columns, ${totalSkips} already existed.`);
  } catch (err: any) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    c.release();
  }
  process.exit(0);
}

main();
