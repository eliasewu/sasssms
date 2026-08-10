/**
 * Integration tests for the feature-toggle audit TRIGGER
 * (drizzle/0039_add_tenant_toggle_audit_trigger.sql).
 *
 * The trigger is the single source of truth for per-tenant feature-toggle
 * changes (smpp/http/rcs/flash/voice-otp/ott/business-api/email/auto-renew):
 * it fires on EVERY update of those columns no matter which path made it. One
 * UPDATE touching several toggles writes one audit row per changed column.
 * These tests run against a dedicated throwaway database
 * (`app_db_toggle_audit_test`, derived from DATABASE_URL): it is created on
 * the fly with minimal tenants + audit_log tables, the REAL 0039 migration
 * SQL is applied, and it is dropped again on teardown. Real data is untouched.
 *
 * Covers:
 *  1. trigger installation — exactly one trigger, and re-apply is idempotent
 *  2. script path  — plain UPDATE without GUCs → changed_by = 'system/script',
 *                    no IP, correct ENABLE/DISABLE action + old/new jsonb
 *  3. route path   — transaction with set_config('app.changed_by'/'app.ip_address')
 *                    GUCs (how the super tenants PUT route writes) → admin email + IP
 *  4. multi-column — one UPDATE changing two toggles → two audit rows
 *  5. no-op        — UPDATE that doesn't change the value creates NO audit row
 *  6. resilience   — audit failure never blocks the tenant update
 *
 * Run:  npx tsx src/lib/__tests__/tenant-toggle-audit.test.ts
 *
 * Prerequisites: PostgreSQL running, DATABASE_URL set, CREATE DATABASE privilege.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";

const TEST_DB_NAME = "app_db_toggle_audit_test";
const MIGRATION_FILE = path.join(process.cwd(), "drizzle", "0039_add_tenant_toggle_audit_trigger.sql");

// The 9 feature-toggle columns audited by 0039 (auto_connect is 0038's job).
const TOGGLE_COLUMNS = [
  "smpp_enabled", "http_enabled", "rcs_enabled", "flash_sms_enabled",
  "voice_otp_enabled", "ott_enabled", "business_api_enabled",
  "email_enabled", "auto_renew_enabled",
];

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

/** Minimal tenants + audit_log tables, then apply the REAL 0039 migration. */
async function setupTestDatabase(): Promise<void> {
  const client = await testPool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      schema_name VARCHAR(100),
      ${TOGGLE_COLUMNS.map((c) => `${c} BOOLEAN NOT NULL DEFAULT true`).join(",\n      ")}
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
    await client.query(fs.readFileSync(MIGRATION_FILE, "utf8"));

    // One synthetic tenant; all toggles default to true.
    await client.query(`INSERT INTO tenants (schema_name) VALUES ('tenant_toggle')`);
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

async function auditRows(tenantId: number): Promise<any[]> {
  const { rows } = await testPool.query(
    `SELECT entity_type, entity_id, action, changed_by, ip_address, old_data, new_data, tenant_id
     FROM audit_log WHERE tenant_id = $1 ORDER BY id`,
    [tenantId]
  );
  return rows;
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
  console.log("Feature-Toggle Audit Trigger Integration Tests");
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
  await test("0039 migration installs exactly one trigger on tenants", async () => {
    const { rows } = await testPool.query(
      `SELECT count(*)::int AS n FROM pg_trigger
       WHERE tgrelid = 'tenants'::regclass AND NOT tgisinternal AND tgname = 'trg_tenant_toggle_audit'`
    );
    assert.equal(rows[0].n, 1, "exactly one toggle trigger");
  });

  await test("0039 migration is idempotent — re-applying leaves exactly one trigger", async () => {
    await testPool.query(fs.readFileSync(MIGRATION_FILE, "utf8"));
    const { rows } = await testPool.query(
      `SELECT count(*)::int AS n FROM pg_trigger
       WHERE tgrelid = 'tenants'::regclass AND NOT tgisinternal AND tgname = 'trg_tenant_toggle_audit'`
    );
    assert.equal(rows[0].n, 1, "still exactly one trigger after re-apply");
  });

  console.log("\n── script path (no GUCs) ──");
  await test("plain UPDATE → changed_by='system/script', no IP, correct old/new", async () => {
    // smpp_enabled starts true (DB default) → flip to false
    await testPool.query("UPDATE tenants SET smpp_enabled = false WHERE id = $1", [tenantId]);
    const rows = await auditRows(tenantId);
    assert.equal(rows.length, 1, "one audit row");
    const r = rows[0];
    assert.equal(r.entity_type, "tenant_toggle", "entity_type = tenant_toggle");
    assert.equal(r.action, "DISABLE", "action = DISABLE");
    assert.equal(r.changed_by, "system/script", "changed_by = system/script");
    assert.equal(r.ip_address, null, "no IP on script path");
    assert.deepEqual(r.old_data, { smpp_enabled: true }, "old_data = {smpp_enabled: true}");
    assert.deepEqual(r.new_data, { smpp_enabled: false }, "new_data = {smpp_enabled: false}");
    assert.equal(r.entity_id, tenantId, "entity_id = tenant id");
  });

  console.log("\n── route path (transaction-local GUCs, exact PUT-route pattern) ──");
  await test("set_config GUCs → changed_by = admin email, IP recorded", async () => {
    const client = await testPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.changed_by', $1, true)", ["admin@net2app.com"]);
      await client.query("SELECT set_config('app.ip_address', $1, true)", ["203.0.113.7"]);
      await client.query("UPDATE tenants SET http_enabled = false WHERE id = $1", [tenantId]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }

    const rows = await auditRows(tenantId);
    const r = rows[rows.length - 1];
    assert.equal(r.action, "DISABLE", "action = DISABLE");
    assert.equal(r.changed_by, "admin@net2app.com", "changed_by = admin email");
    assert.equal(r.ip_address, "203.0.113.7", "IP recorded");
    assert.deepEqual(r.new_data, { http_enabled: false }, "new_data = {http_enabled: false}");
  });

  await test("GUCs are transaction-local — next plain UPDATE is 'system/script' again", async () => {
    await testPool.query("UPDATE tenants SET rcs_enabled = false WHERE id = $1", [tenantId]);
    const rows = await auditRows(tenantId);
    const r = rows[rows.length - 1];
    assert.equal(r.changed_by, "system/script", "no GUC leakage");
    assert.equal(r.ip_address, null, "no IP leakage");
  });

  console.log("\n── multi-column ──");
  await test("one UPDATE changing two toggles writes TWO audit rows", async () => {
    const before = await auditRowCount(tenantId);
    await testPool.query(
      "UPDATE tenants SET voice_otp_enabled = false, business_api_enabled = false WHERE id = $1",
      [tenantId]
    );
    const rows = await auditRows(tenantId);
    assert.equal(rows.length, before + 2, "two new audit rows");

    const lastTwo = rows.slice(-2);
    assert.deepEqual(
      lastTwo.map((r) => Object.keys(r.new_data)[0]).sort(),
      ["business_api_enabled", "voice_otp_enabled"],
      "both changed columns recorded"
    );
    for (const r of lastTwo) {
      const col = Object.keys(r.new_data)[0];
      assert.equal(r.action, "DISABLE", `${col}: DISABLE`);
      assert.equal(r.new_data[col], false, `${col}: new value false`);
    }
  });

  console.log("\n── no-op ──");
  await test("UPDATE with unchanged value creates NO audit row", async () => {
    const before = await auditRowCount(tenantId);
    await testPool.query("UPDATE tenants SET email_enabled = email_enabled WHERE id = $1", [tenantId]);
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
      await testPool.query("UPDATE tenants SET ott_enabled = false WHERE id = $1", [tenantId]);
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
