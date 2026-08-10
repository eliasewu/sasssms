/**
 * Integration tests for syncMccMncToTenants (src/lib/mcc-mnc-sync.ts).
 *
 * The helper propagates a global MCC/MNC change into EVERY active tenant's
 * shared-default rate rows, so running it against the real app database would
 * write test rows into real tenants. These tests therefore run against a
 * dedicated throwaway database (`app_db_test`, derived from DATABASE_URL):
 * it is created on the fly, seeded with two synthetic active tenants, and
 * dropped again on teardown. Real tenant data is never touched.
 *
 * Covers:
 *  1. create — inserts shared-default rows (client_id=-1 / supplier_id=-1)
 *     into every active tenant, with zero-padded MNC, mccmnc, and default rates
 *  2. create — idempotent (dedupe on padded key), incl. "3" vs "003"
 *  3. update — key changed: old rows removed, new key inserted everywhere
 *  4. update — key unchanged: rows updated in place
 *  5. delete — shared-default rows removed from every tenant
 *  6. delete — no-op when the key doesn't exist
 *
 * Run:  npx tsx src/lib/__tests__/mcc-mnc-sync.test.ts
 *
 * Prerequisites: PostgreSQL running, DATABASE_URL set, CREATE DATABASE privilege.
 */
import assert from "node:assert/strict";
import { Pool } from "pg";
import { syncMccMncToTenants } from "@/lib/mcc-mnc-sync";
import type { MccMncSyncStats } from "@/lib/mcc-mnc-sync";

const TEST_DB_NAME = "app_db_test";
const TEST_TENANTS = ["tenant_sync_a", "tenant_sync_b"];

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

/** Recreate the two synthetic tenant schemas + rate tables from scratch. */
async function setupTestDatabase(): Promise<void> {
  const client = await testPool.connect();
  try {
    await client.query("SET search_path TO public");
    await client.query(`CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      schema_name VARCHAR(100) NOT NULL,
      is_active BOOLEAN DEFAULT true
    )`);
    await client.query("DELETE FROM tenants");

    for (const schema of TEST_TENANTS) {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await client.query(`CREATE SCHEMA "${schema}"`);
      // Mirrors the client_rates / supplier_rates shape the helper writes to.
      await client.query(`CREATE TABLE "${schema}".client_rates (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL,
        country_code VARCHAR(10) NOT NULL,
        mcc VARCHAR(10),
        mnc VARCHAR(10),
        mccmnc VARCHAR(6),
        operator_name VARCHAR(255),
        rate DECIMAL(10,6) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        updated_at TIMESTAMP DEFAULT NOW()
      )`);
      await client.query(`CREATE TABLE "${schema}".supplier_rates (
        id SERIAL PRIMARY KEY,
        supplier_id INTEGER NOT NULL,
        country_code VARCHAR(10) NOT NULL,
        mcc VARCHAR(10),
        mnc VARCHAR(10),
        mccmnc VARCHAR(6),
        operator_name VARCHAR(255),
        cost DECIMAL(10,6) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        updated_at TIMESTAMP DEFAULT NOW()
      )`);
      await client.query(`INSERT INTO tenants (schema_name, is_active) VALUES ($1, true)`, [schema]);
    }
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

async function q(schema: string, sql: string, params: unknown[] = []): Promise<any[]> {
  const client = await testPool.connect();
  try {
    await client.query(`SET search_path TO "${schema}"`);
    const { rows } = await client.query(sql, params);
    return rows;
  } finally {
    await client.query("SET search_path TO public");
    client.release();
  }
}

async function resetRateTables(): Promise<void> {
  for (const s of TEST_TENANTS) {
    await q(s, "DELETE FROM client_rates");
    await q(s, "DELETE FROM supplier_rates");
  }
}

// ── Assertion helpers ──

function assertStats(stats: MccMncSyncStats, expected: Partial<MccMncSyncStats>, label: string): void {
  for (const [k, v] of Object.entries(expected)) {
    assert.equal((stats as unknown as Record<string, number>)[k], v, `${label}: stats.${k}`);
  }
}

function assertClose(actual: number | string, expected: number, label: string): void {
  const n = typeof actual === "string" ? parseFloat(actual) : actual;
  assert.ok(Math.abs(n - expected) < 0.000001, `${label}: expected ~${expected}, got ${actual}`);
}

// ── Test runner ──

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  await resetRateTables();
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
// SUITE 1: create
// ═══════════════════════════════════════════════════════════

async function suiteCreate() {
  console.log("\n── create ──");

  await test("create inserts shared-default rows into every active tenant", async () => {
    const stats = await syncMccMncToTenants(
      testPool,
      { mcc: "999", mnc: "1", countryCode: "TST", networkName: "TestNet" },
      "create"
    );
    assertStats(stats, { tenants: 2, inserted: 4, updated: 0, deleted: 0, failed: 0 }, "create");

    for (const s of TEST_TENANTS) {
      const cr = (await q(s, "SELECT * FROM client_rates WHERE client_id = -1"))[0];
      assert.ok(cr, `${s}: client_rates row exists`);
      assert.equal(cr.mcc, "999", `${s}: mcc stored`);
      assert.equal(cr.mnc, "001", `${s}: mnc zero-padded (1 → 001)`);
      assert.equal(cr.mccmnc, "999001", `${s}: mccmnc computed`);
      assert.equal(cr.operator_name, "TestNet", `${s}: operator_name stored`);
      assert.equal(cr.country_code, "TST", `${s}: country_code stored`);
      assertClose(cr.rate, 0.00025, `${s}: client default rate 0.00025`);

      const sr = (await q(s, "SELECT * FROM supplier_rates WHERE supplier_id = -1"))[0];
      assert.ok(sr, `${s}: supplier_rates row exists`);
      assert.equal(sr.mnc, "001", `${s}: supplier mnc padded`);
      assert.equal(sr.mccmnc, "999001", `${s}: supplier mccmnc`);
      assertClose(sr.cost, 0.00020, `${s}: supplier default cost 0.00020`);
    }
  });

  await test("create is idempotent — duplicate sync inserts nothing", async () => {
    const entry = { mcc: "999", mnc: "1", countryCode: "TST", networkName: "TestNet" };
    await syncMccMncToTenants(testPool, entry, "create");
    const stats = await syncMccMncToTenants(testPool, entry, "create");
    assertStats(stats, { tenants: 2, inserted: 0, deleted: 0 }, "second create");

    for (const s of TEST_TENANTS) {
      const cr = (await q(s, "SELECT COUNT(*)::int AS n FROM client_rates"))[0].n;
      const sr = (await q(s, "SELECT COUNT(*)::int AS n FROM supplier_rates"))[0].n;
      assert.equal(cr, 1, `${s}: still one client_rates row`);
      assert.equal(sr, 1, `${s}: still one supplier_rates row`);
    }
  });

  await test("create dedupes '3' vs '003' on the padded MNC key", async () => {
    // Legacy unpadded rows already exist in tenant A only (both rate tables).
    await q("tenant_sync_a", `INSERT INTO client_rates (client_id, country_code, mcc, mnc, mccmnc, operator_name, rate)
                              VALUES (-1, 'ZZZ', '998', '3', '998003', 'LegacyNet', 0.00025)`);
    await q("tenant_sync_a", `INSERT INTO supplier_rates (supplier_id, country_code, mcc, mnc, mccmnc, operator_name, cost)
                              VALUES (-1, 'ZZZ', '998', '3', '998003', 'LegacyNet', 0.00020)`);

    const stats = await syncMccMncToTenants(
      testPool,
      { mcc: "998", mnc: "003", countryCode: "ZZZ", networkName: "LegacyNet" },
      "create"
    );
    // tenant_a already has the network (unpadded mnc) → both inserts skipped;
    // tenant_b gets both (client_rates + supplier_rates).
    assertStats(stats, { tenants: 2, inserted: 2, deleted: 0 }, "padded-key dedupe");

    const aClient = (await q("tenant_sync_a", "SELECT COUNT(*)::int AS n FROM client_rates WHERE client_id = -1"))[0].n;
    const aSupplier = (await q("tenant_sync_a", "SELECT COUNT(*)::int AS n FROM supplier_rates WHERE supplier_id = -1"))[0].n;
    assert.equal(aClient, 1, "tenant_a: no duplicate client row");
    assert.equal(aSupplier, 1, "tenant_a: no duplicate supplier row");

    const bRow = (await q("tenant_sync_b", "SELECT * FROM client_rates WHERE client_id = -1"))[0];
    assert.ok(bRow, "tenant_b: row inserted");
    assert.equal(bRow.mnc, "003", "tenant_b: stored canonical padded mnc");
  });
}

// ═══════════════════════════════════════════════════════════
// SUITE 2: update
// ═══════════════════════════════════════════════════════════

async function suiteUpdate() {
  console.log("\n── update ──");

  await test("update with changed key re-keys rows in every tenant", async () => {
    await syncMccMncToTenants(
      testPool,
      { mcc: "997", mnc: "1", countryCode: "TST", networkName: "OldNet" },
      "create"
    );
    const stats = await syncMccMncToTenants(
      testPool,
      { mcc: "997", mnc: "2", countryCode: "TST", networkName: "NewNet" },
      "update",
      { mcc: "997", mnc: "1" }
    );
    assertStats(stats, { tenants: 2, inserted: 4, updated: 0, deleted: 4 }, "re-key update");

    for (const s of TEST_TENANTS) {
      const oldCr = (await q(s, "SELECT COUNT(*)::int AS n FROM client_rates WHERE mcc = $1 AND mnc = '001'", ["997"]))[0].n;
      const oldSr = (await q(s, "SELECT COUNT(*)::int AS n FROM supplier_rates WHERE mcc = $1 AND mnc = '001'", ["997"]))[0].n;
      assert.equal(oldCr, 0, `${s}: old key removed from client_rates`);
      assert.equal(oldSr, 0, `${s}: old key removed from supplier_rates`);

      const newRow = (await q(s, "SELECT * FROM client_rates WHERE mcc = $1", ["997"]))[0];
      assert.ok(newRow, `${s}: new row exists`);
      assert.equal(newRow.mnc, "002", `${s}: new mnc zero-padded`);
      assert.equal(newRow.mccmnc, "997002", `${s}: mccmnc recomputed`);
      assert.equal(newRow.operator_name, "NewNet", `${s}: operator_name updated`);
    }
  });

  await test("update with unchanged key updates values in place", async () => {
    await syncMccMncToTenants(
      testPool,
      { mcc: "996", mnc: "5", countryCode: "TST", networkName: "Before" },
      "create"
    );
    const stats = await syncMccMncToTenants(
      testPool,
      { mcc: "996", mnc: "5", countryCode: "AAA", networkName: "After" },
      "update",
      { mcc: "996", mnc: "5" }
    );
    assertStats(stats, { tenants: 2, inserted: 0, updated: 4, deleted: 0 }, "in-place update");

    for (const s of TEST_TENANTS) {
      const row = (await q(s, "SELECT * FROM client_rates WHERE client_id = -1"))[0];
      assert.equal(row.country_code, "AAA", `${s}: country_code updated`);
      assert.equal(row.operator_name, "After", `${s}: operator_name updated`);
      assert.equal(row.mnc, "005", `${s}: mnc still padded`);
      assert.equal(row.mccmnc, "996005", `${s}: mccmnc preserved`);
    }
  });
}

// ═══════════════════════════════════════════════════════════
// SUITE 3: delete
// ═══════════════════════════════════════════════════════════

async function suiteDelete() {
  console.log("\n── delete ──");

  await test("delete removes shared-default rows from every tenant", async () => {
    await syncMccMncToTenants(
      testPool,
      { mcc: "995", mnc: "7", countryCode: "TST", networkName: "DelNet" },
      "create"
    );
    const stats = await syncMccMncToTenants(
      testPool,
      { mcc: "995", mnc: "7", countryCode: "TST", networkName: "DelNet" },
      "delete"
    );
    assertStats(stats, { tenants: 2, inserted: 0, updated: 0, deleted: 4 }, "delete");

    for (const s of TEST_TENANTS) {
      assert.equal((await q(s, "SELECT COUNT(*)::int AS n FROM client_rates"))[0].n, 0, `${s}: client_rates emptied`);
      assert.equal((await q(s, "SELECT COUNT(*)::int AS n FROM supplier_rates"))[0].n, 0, `${s}: supplier_rates emptied`);
    }
  });

  await test("delete of a missing key is a safe no-op", async () => {
    const stats = await syncMccMncToTenants(
      testPool,
      { mcc: "994", mnc: "1", countryCode: "TST", networkName: "Ghost" },
      "delete"
    );
    assertStats(stats, { tenants: 2, inserted: 0, updated: 0, deleted: 0 }, "no-op delete");
  });
}

// ═══════════════════════════════════════════════════════════
// Run all suites
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log("MCC/MNC Sync Integration Tests");
  console.log("═══════════════════════════════");

  try {
    await ensureTestDatabase();
    testPool = new Pool({ connectionString: buildTestDbUrl() });
    await setupTestDatabase();
  } catch (err) {
    console.error("  ❌ Cannot set up test database:", (err as Error).message);
    console.error("  Make sure PostgreSQL is running, DATABASE_URL is set, and the user can CREATE DATABASE.");
    process.exit(1);
  }

  await suiteCreate();
  await suiteUpdate();
  await suiteDelete();

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
