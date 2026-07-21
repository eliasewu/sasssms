/**
 * Migrate existing tenants: add dlr_poll_seconds, dlr_timeout_seconds to
 * custom_api_connectors and last_dlr_poll_at to messages.
 *
 * Usage: npx tsx scripts/migrate-dlr-poll-settings.ts
 */
import { pool } from "@/db";

async function main() {
  const client = await pool.connect();
  try {
    // Get all active tenant schemas
    const { rows: tenants } = await client.query(
      "SELECT id, schema_name FROM tenants WHERE is_active = true"
    );

    console.log(`Found ${tenants.length} active tenants`);

    for (const tenant of tenants) {
      const schema = tenant.schema_name;
      try {
        await client.query(`SET search_path TO "${schema}"`);

        // Add columns to custom_api_connectors (if they don't exist)
        await client.query(
          `ALTER TABLE custom_api_connectors ADD COLUMN IF NOT EXISTS dlr_poll_seconds INTEGER DEFAULT 30`
        );
        await client.query(
          `ALTER TABLE custom_api_connectors ADD COLUMN IF NOT EXISTS dlr_timeout_seconds INTEGER DEFAULT 3600`
        );

        // Add last_dlr_poll_at to messages (if it doesn't exist)
        await client.query(
          `ALTER TABLE messages ADD COLUMN IF NOT EXISTS last_dlr_poll_at TIMESTAMP`
        );

        console.log(`  ✓ ${schema}: migrated`);
      } catch (err) {
        console.error(`  ✗ ${schema}: ${(err as Error).message}`);
      }
    }

    await client.query("SET search_path TO public");
    console.log("\nMigration complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
