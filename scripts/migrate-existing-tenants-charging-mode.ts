/**
 * Migrate all existing tenants: add charging_mode + dlr_timeout columns
 * and convert billing_mode/force_dlr to charging_mode.
 * Run: npx tsx scripts/migrate-existing-tenants-charging-mode.ts
 */
import { pool } from "@/db";

async function main() {
  const c = await pool.connect();
  try {
    const { rows: tenants } = await c.query(
      "SELECT id, company_name, schema_name FROM tenants WHERE is_active = true ORDER BY id"
    );

    console.log(`Migrating ${tenants.length} active tenants...\n`);

    let totalUpdated = 0;

    for (const t of tenants) {
      const schema = t.schema_name;
      if (!/^[a-z0-9_]+$/.test(schema)) {
        console.log(`  ⚠️  Skipping ${t.company_name}: invalid schema name`);
        continue;
      }

      try {
        // Add columns
        await c.query(`ALTER TABLE "${schema}".clients ADD COLUMN IF NOT EXISTS charging_mode VARCHAR(50) DEFAULT 'on_submit'`);
        await c.query(`ALTER TABLE "${schema}".clients ADD COLUMN IF NOT EXISTS dlr_timeout INTEGER`);
        await c.query(`ALTER TABLE "${schema}".suppliers ADD COLUMN IF NOT EXISTS charging_mode VARCHAR(50) DEFAULT 'on_submit'`);
        await c.query(`ALTER TABLE "${schema}".suppliers ADD COLUMN IF NOT EXISTS dlr_timeout INTEGER`);

        // Migrate client data
        const clientResult1 = await c.query(
          `UPDATE "${schema}".clients SET charging_mode = 'on_dlr' WHERE billing_mode = 'dlr' AND COALESCE(force_dlr, false) = false`
        );
        const clientResult2 = await c.query(
          `UPDATE "${schema}".clients SET charging_mode = 'force_dlr' WHERE COALESCE(force_dlr, false) = true`
        );

        // Migrate supplier data
        const suppResult = await c.query(
          `UPDATE "${schema}".suppliers SET charging_mode = 'force_dlr' WHERE COALESCE(force_dlr, false) = true`
        );

        const updated = (clientResult1.rowCount || 0) + (clientResult2.rowCount || 0) + (suppResult.rowCount || 0);
        totalUpdated += updated;
        console.log(`  ✅ ${t.company_name}: ${updated} records migrated`);
      } catch (err: any) {
        console.error(`  ❌ ${t.company_name} (${schema}): ${err.message}`);
      }
    }

    console.log(`\n🎉 Done! ${totalUpdated} records migrated across all tenants.`);
  } catch (err: any) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    c.release();
  }
  process.exit(0);
}

main();
