/**
 * cleanup-translation-assignments.ts
 *
 * Cleans up stale `is_active=false` translation_assignments across ALL tenant schemas.
 *
 * For each profile:
 *   - Keeps active (is_active=true) assignments and deletes the rest.
 *   - If a profile has NO active assignments, reactivates the most recent one (highest id).
 *   - If a profile has only one assignment (active or not), leaves it alone.
 *
 * This is safe to re-run — it's idempotent.
 *
 * Run: npx tsx scripts/cleanup-translation-assignments.ts
 */
import { pool } from "../src/db";

async function main() {
  const client = await pool.connect();
  try {
    const { rows: tenants } = await client.query(
      "SELECT id, schema_name, company_name FROM tenants WHERE is_active = true ORDER BY id"
    );

    console.log(`Found ${tenants.length} active tenant(s)\n`);

    let totalDeleted = 0;
    let totalReactivated = 0;
    let totalProfilesCleaned = 0;

    for (const t of tenants) {
      try {
        await client.query(`SET search_path TO "${t.schema_name}"`);

        // Check if translation_assignments table exists in this schema
        const { rows: tableCheck } = await client.query(
          `SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = 'translation_assignments'
          ) as exists`,
          [t.schema_name]
        );

        if (!tableCheck[0]?.exists) {
          console.log(`  SKIP ${t.schema_name}: no translation_assignments table`);
          continue;
        }

      // ── Step 1: Delete inactive assignments where an active one exists ──
      // For profiles with at least one active assignment, delete all inactive ones.
      const delResult = await client.query(`
        DELETE FROM translation_assignments
        WHERE is_active = false
          AND profile_id IN (
            SELECT profile_id FROM translation_assignments
            WHERE is_active = true
          )
        RETURNING id
      `);

      const deleted = delResult.rowCount ?? 0;
      if (deleted > 0) {
        console.log(`  🧹 ${t.schema_name}: deleted ${deleted} stale inactive assignment(s)`);
        totalDeleted += deleted;
      }

      // ── Step 2: Reactivate profiles where ALL assignments are inactive ──
      // These profiles would have no assignments visible after the fix (is_active=true filter).
      // Reactivate the most recent assignment (highest id) for each such profile.
      const reactResult = await client.query(`
        UPDATE translation_assignments
        SET is_active = true
        WHERE id IN (
          SELECT DISTINCT ON (profile_id) id
          FROM translation_assignments
          WHERE profile_id IN (
            SELECT profile_id FROM translation_assignments
            GROUP BY profile_id
            HAVING bool_or(is_active) = false
          )
          ORDER BY profile_id, id DESC
        )
        RETURNING id, profile_id
      `);

      const reactivated = reactResult.rowCount ?? 0;
      if (reactivated > 0) {
        console.log(`  🔄 ${t.schema_name}: reactivated ${reactivated} assignment(s) for profiles with no active assignments`);
        totalReactivated += reactivated;
      }

      // ── Step 3: Report on remaining profiles ──
      const { rows: stats } = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE is_active = true) as active_count,
          COUNT(*) FILTER (WHERE is_active = false) as inactive_count,
          COUNT(DISTINCT profile_id) as profile_count
        FROM translation_assignments
      `);

      if (deleted > 0 || reactivated > 0) {
        totalProfilesCleaned += parseInt(stats[0]?.profile_count || "0");
        console.log(`     → now: ${stats[0]?.active_count} active, ${stats[0]?.inactive_count} inactive across ${stats[0]?.profile_count} profile(s)`);
      } else if (stats[0]?.active_count > 0) {
        // Nothing to clean but report state
        console.log(`  ✅ ${t.schema_name}: clean — ${stats[0]?.active_count} active assignment(s) across ${stats[0]?.profile_count} profile(s)`);
      }
      } catch (err) {
        console.warn(`  ⚠️ ${t.schema_name}: ${(err as Error).message}`);
      }
    }

    await client.query("SET search_path TO public");
    console.log(`\n── Summary ──`);
    console.log(`  Deleted stale assignments:  ${totalDeleted}`);
    console.log(`  Reactivated profiles:       ${totalReactivated}`);
    console.log(`  Tenants scanned:            ${tenants.length}`);
    console.log(`\n✅ Cleanup complete.`);
  } finally {
    client.release();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
