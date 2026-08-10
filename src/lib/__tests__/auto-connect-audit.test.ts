/**
 * Integration tests for the Auto-Connect approval audit TRIGGER
 * (drizzle/0038_add_auto_connect_audit_trigger.sql).
 *
 * The trigger is the single source of truth for auto-connect approval changes:
 * it fires on EVERY update of tenants.auto_connect_enabled no matter which
 * path made it (super UI route, a future API, a cron job, or raw SQL). These
 * tests run against a dedicated throwaway database (`app_db_auto_connect_test`,
 * derived from DATABASE_URL): it is created on the fly with minimal
 * tenants + audit_log tables, the REAL 0038 migration SQL is applied, and it
 * is dropped again on teardown. Real tenant data is never touched.
 *
 * Covers:
 *  1. trigger installation — the 0038 migration creates exactly one trigger
 *  2. script path  — plain UPDATE without GUCs → changed_by = 'system/script',
 *                    no IP, correct ENABLE/DISABLE action + old/new jsonb
 *  3. route path   — transaction with set_config('app.changed_by'/'app.ip_address')
 *                    GUCs (exactly how the super tenants PUT route writes) →
 *                    changed_by = admin email, IP recorded
 *  4. GUC scoping  — GUCs are transaction-local: the next plain UPDATE is
 *                    attributed to 'system/script' again (no leakage)
 *  5. no-op        — an UPDATE that doesn't change the value creates NO audit row
 *
 * Run:  npx tsx src/lib/__tests__/auto-connect-audit.test.ts
 *
 * Prerequisites: PostgreSQL running, DATABASE_URL set, CREATE DATABASE privilege.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const TEST_DB_NAME = "app_db_auto_connect_test";
const MIGRATION_FILE = path.join(process.cwd(), "drizzle", "0038_add_auto_connect_audit_trigger.sql");

let testPool: Pool;

// ── Database setup / teardown ──

function buildTestDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const u = new URL(url);
  u.pathname = `/${TEST_DB_NAME}`;
  return u.toString();
}

async function ensureTestDatabase(): Promise<void> {
  const admin = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await admin.connect();
  try {
    const { rows } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [TEST_DB_NAME]);
    if (rows.length === 0) {
      await client.query(`CREATE DATABASE ${TEST_DB_NAME}`);
      console.log(`  Created test database ${TEST_DB_NAME}`);
    }
  } finally {
    client.release();
    await admin.end();
  }
}

/** Minimal tenants + audit_log tables, then apply the REAL 0038 migration. */
async function setupTestDatabase(): Promise<void> {
  const client = await testPool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      schema_name VARCHAR(100),
      auto_connect_enabled BOOLEAN NOT NULL DEFAULT true
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      entity_type VARCHAR(50),
      entity_id INTEGER,
      action VARCHAR(20),
      changed_by VARCHAR(255),
      old_data JSONB,
      new_data JSONB,
      ip_address VARCHAR(50),
      created_at TIMESTAMP DEFAULT NOW(),
      tenant_id INTEGER
    )`);
    await client.query("DELETE FROM tenants");
    await client.query("DELETE FROM audit_log");

    // Apply the actual migration under test — idempotent by design.
    const sql = fs.readFileSync(MIGRATION_FILE, "utf8");
    await client.query(sql);

    // One synthetic tenant; auto_connect_enabled defaults to true (DB default).
    await client.query(`INSERT INTO tenants (schema_name) VALUES ('tenant_audit')`);
  } finally {
    client.release();
  }
}

async function teardownTestDatabase(): Promise<void> {
  try {
    await testPool.end();
  } catch { /* ignore */ }
  const admin = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await admin.connect();
  try {
    // Kick any lingering connections (e.g. from a crashed run), then drop.
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [TEST_DB_NAME]
    );
    await client.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
  } catch (e) {
    console.error(`  ⚠️ Could not drop test database: ${(e as Error).message}`);
  } finally {
    client.release();
    await admin.end();
  }
}

// ── Query helpers ──

async function lastAuditRow(tenantId: number): Promise<any> {
  const { rows } = await testPool.query(
    `SELECT entity_type, entity_id, action, changed_by, ip_address, old_data, new_data, tenant_id
     FROM audit_log WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1`,
    [tenantId]
  );
  return rows[0];
}

async function auditRowCount(tenantId: number): Promise<number> {
  const { rows } = await testPool.query(
    "SELECT COUNT(*)::int AS n FROM audit_log WHERE tenant_id = $1",
    [tenantId]
  );
  return rows[0].n;
}

// ── Test runner ──

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}: ${(err as Error).message}`);
  }
}

// ═══════════════════════════════════════════════════════════
// Run all suites
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log("Auto-Connect Audit Trigger Integration Tests");
  console.log("═══════════════════════════════════════════════");

  try {
    await ensureTestDatabase();
    testPool = new Pool({ connectionString: buildTestDbUrl() });
    await setupTestDatabase();
  } catch (err) {
    console.error("  ❌ Cannot set up test database:", (err as Error).message);
    console.error("  Make sure PostgreSQL is running, DATABASE_URL is set, and the user can CREATE DATABASE.");
    process.exit(1);
  }

  const tenantId = 1; // the single synthetic tenant

  console.log("\n── trigger installation ──");
  await test("0038 migration installs exactly one trigger on tenants", async () => {
    const { rows } = await testPool.query(
      `SELECT count(*)::int AS n FROM pg_trigger
       WHERE tgrelid = 'tenants'::regclass AND NOT tgisinternal`
    );
    assert.equal(rows[0].n, 1, "one trigger on tenants");
  });

  await test("0038 migration is idempotent — re-applying leaves exactly one trigger", async () => {
    // Re-run the migration file, as a deploy or manual re-apply would.
    await testPool.query(fs.readFileSync(MIGRATION_FILE, "utf8"));
    const { rows } = await testPool.query(
      `SELECT count(*)::int AS n FROM pg_trigger
       WHERE tgrelid = 'tenants'::regclass AND NOT tgisinternal`
    );
    assert.equal(rows[0].n, 1, "still exactly one trigger after re-apply");
  });

  console.log("\n── script path (no GUCs) ──");
  await test("plain UPDATE → changed_by='system/script', no IP, correct old/new", async () => {
    // tenant starts with auto_connect_enabled = true (DB default)
    await testPool.query("UPDATE tenants SET auto_connect_enabled = false WHERE id = $1", [tenantId]);
    const row = await lastAuditRow(tenantId);
    assert.ok(row, "audit row written");
    assert.equal(row.action, "DISABLE", "action = DISABLE");
    assert.equal(row.changed_by, "system/script", "changed_by = system/script");
    assert.equal(row.ip_address, null, "no IP on script path");
    assert.deepEqual(row.old_data, { autoConnectEnabled: true }, "old_data = {true}");
    assert.deepEqual(row.new_data, { autoConnectEnabled: false }, "new_data = {false}");
    assert.equal(row.entity_id, tenantId, "entity_id = tenant id");
  });

  console.log("\n── route path (transaction-local GUCs, exact PUT-route pattern) ──");
  await test("set_config GUCs → changed_by = admin email, IP recorded", async () => {
    const client = await testPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.changed_by', $1, true)", ["admin@net2app.com"]);
      await client.query("SELECT set_config('app.ip_address', $1, true)", ["203.0.113.7"]);
      await client.query("UPDATE tenants SET auto_connect_enabled = true WHERE id = $1", [tenantId]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    const row = await lastAuditRow(tenantId);
    assert.ok(row, "audit row written");
    assert.equal(row.action, "ENABLE", "action = ENABLE");
    assert.equal(row.changed_by, "admin@net2app.com", "changed_by = admin email");
    assert.equal(row.ip_address, "203.0.113.7", "IP recorded");
    assert.deepEqual(row.new_data, { autoConnectEnabled: true }, "new_data = {true}");
  });

  await test("GUCs are transaction-local — next plain UPDATE is 'system/script' again", async () => {
    await testPool.query("UPDATE tenants SET auto_connect_enabled = false WHERE id = $1", [tenantId]);
    const row = await lastAuditRow(tenantId);
    assert.equal(row.changed_by, "system/script", "no GUC leakage");
    assert.equal(row.ip_address, null, "no IP leakage");
  });

  console.log("\n── no-op ──");
  await test("UPDATE with unchanged value creates NO audit row", async () => {
    const before = await auditRowCount(tenantId);
    await testPool.query("UPDATE tenants SET auto_connect_enabled = auto_connect_enabled WHERE id = $1", [tenantId]);
    const after = await auditRowCount(tenantId);
    assert.equal(after, before, "no audit row on no-op");
  });

  console.log("\n── resilience ──");
  await test("audit failure never blocks the tenant update (exception handler)", async () => {
    const before = await auditRowCount(tenantId);
    let renamed = false;
    try {
      await testPool.query("ALTER TABLE audit_log RENAME TO audit_log_bak");
      renamed = true;
      // The UPDATE must succeed even though the trigger's audit INSERT will fail.
      await testPool.query("UPDATE tenants SET auto_connect_enabled = NOT auto_connect_enabled WHERE id = $1", [tenantId]);
    } finally {
      if (renamed) {
        await testPool.query("ALTER TABLE audit_log_bak RENAME TO audit_log").catch(() => {});
      }
    }
    const after = await auditRowCount(tenantId);
    assert.equal(after, before, "no audit row while audit_log was unavailable");
  });

  await teardownTestDatabase();

  console.log(`\n── Results ──`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);

  if (failed > 0) {
    console.error(`\n❌ ${failed} test(s) FAILED`);
    process.exit(1);
  } else {
    console.log(`\n✅ All tests passed!`);
    process.exit(0);
  }
}

main();
