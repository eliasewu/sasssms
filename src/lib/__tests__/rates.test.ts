/**
 * Integration tests for the Rate Lookup helpers (src/lib/rates.ts).
 *
 * Tests REAL database queries against a live PostgreSQL instance.
 * Uses the first active tenant schema as a sandbox — inserts test data into
 * client_rates and supplier_rates, then verifies prefix matching.
 *
 * Covers:
 *  1. lookupClientRate — prefix match with leading + (+8801712...)
 *  2. lookupClientRate — prefix match without leading + (8801712...)
 *  3. lookupClientRate — longest-prefix-wins (e.g. +1 vs +1416)
 *  4. lookupClientRate — falls back to default when no rate configured
 *  5. lookupClientRate — respects is_active flag (inactive rates ignored)
 *  6. lookupSupplierCost — same prefix-matching semantics
 *  7. Both helpers — concurrent lookups (connection pool safety)
 *  8. Both helpers — empty/invalid destination returns default
 *
 * Run:  npx tsx src/lib/__tests__/rates.test.ts
 *
 * Prerequisites: PostgreSQL running, .env with DATABASE_URL, at least 1 active tenant
 */
import assert from "node:assert/strict";
import { pool } from "@/db";
import { lookupClientRate, lookupSupplierCost } from "@/lib/rates";

// ── Test context ──

interface TestContext {
  tenantId: number;
  schemaName: string;
}

let ctx: TestContext | null = null;

async function getTestContext(): Promise<TestContext> {
  if (ctx) return ctx;
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT id, schema_name FROM tenants WHERE is_active = true ORDER BY id LIMIT 1"
    );
    if (rows.length === 0) throw new Error("No active tenants found");
    ctx = { tenantId: rows[0].id, schemaName: rows[0].schema_name };
    console.log(`  Using tenant: ${ctx.schemaName} (id=${ctx.tenantId})`);
    return ctx;
  } finally {
    client.release();
  }
}

// ── DB helpers ──

async function clearRates(): Promise<void> {
  const { schemaName } = await getTestContext();
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    await client.query("DELETE FROM client_rates WHERE client_id >= 90000");
    await client.query("DELETE FROM supplier_rates WHERE supplier_id >= 90000");
  } finally {
    await client.query("SET search_path TO public");
    client.release();
  }
}

async function insertClientRate(
  clientId: number,
  countryCode: string,
  rate: number,
  isActive: boolean = true,
  mcc?: string,
  mnc?: string,
  operatorName?: string
): Promise<void> {
  const { schemaName } = await getTestContext();
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    await client.query(
      `INSERT INTO client_rates (client_id, country_code, rate, is_active, mcc, mnc, operator_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [clientId, countryCode, rate.toString(), isActive, mcc || null, mnc || null, operatorName || null]
    );
  } finally {
    await client.query("SET search_path TO public");
    client.release();
  }
}

async function insertSupplierRate(
  supplierId: number,
  countryCode: string,
  cost: number,
  isActive: boolean = true,
  mcc?: string,
  mnc?: string,
  operatorName?: string
): Promise<void> {
  const { schemaName } = await getTestContext();
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    await client.query(
      `INSERT INTO supplier_rates (supplier_id, country_code, cost, is_active, mcc, mnc, operator_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [supplierId, countryCode, cost.toString(), isActive, mcc || null, mnc || null, operatorName || null]
    );
  } finally {
    await client.query("SET search_path TO public");
    client.release();
  }
}

// ── Test runner ──

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  await clearRates();
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}: ${(err as Error).message}`);
  }
}

// ── Custom assert helpers (async-safe) ──

function assertClose(actual: number, expected: number, delta: number, label: string): void {
  const diff = Math.abs(actual - expected);
  assert.ok(
    diff <= delta,
    `${label}: expected ~${expected} (±${delta}), got ${actual} (diff=${diff})`
  );
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE 1: lookupClientRate — prefix matching
// ═══════════════════════════════════════════════════════════

async function suiteClientRatePrefixMatch() {
  console.log("\n── lookupClientRate: Prefix Matching ──");

  await test("matches +880 prefix (Bangladesh)", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90001, "880", 0.00050);

    const rate = await lookupClientRate("+8801712345678", 90001, schemaName);
    assertClose(rate, 0.00050, 0.000001, "rate for +8801712...");
  });

  await test("matches 880 prefix without leading +", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90002, "880", 0.00045);

    const rate = await lookupClientRate("8801712345678", 90002, schemaName);
    assertClose(rate, 0.00045, 0.000001, "rate for 8801712... (no +)");
  });

  await test("matches +1 prefix (US/Canada)", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90003, "1", 0.00030);

    const rate = await lookupClientRate("+14165551234", 90003, schemaName);
    assertClose(rate, 0.00030, 0.000001, "rate for +1416555...");
  });

  await test("matches +254 prefix (Kenya)", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90004, "254", 0.00075);

    const rate = await lookupClientRate("+254712345678", 90004, schemaName);
    assertClose(rate, 0.00075, 0.000001, "rate for +2547123...");
  });

  await test("matches +251 prefix (Ethiopia)", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90005, "251", 0.00055);

    const rate = await lookupClientRate("+251974726782", 90005, schemaName);
    assertClose(rate, 0.00055, 0.000001, "rate for +2519747...");
  });

  await test("matches long prefix like +9715 (UAE mobile)", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90006, "971", 0.00020);
    await insertClientRate(90006, "9715", 0.00015);

    const rate = await lookupClientRate("+971501234567", 90006, schemaName);
    assertClose(rate, 0.00015, 0.000001, "rate for +97150...");
    assert.equal(rate, 0.00015, "longest prefix should win for +97150");
  });

  await test("longest-prefix-wins: +1 vs +1416", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90007, "1", 0.00020);
    await insertClientRate(90007, "1416", 0.00010);

    // +14165551234 should match "1416" (length 4) over "1" (length 1)
    const rate = await lookupClientRate("+14165551234", 90007, schemaName);
    assertClose(rate, 0.00010, 0.000001, "rate for +14165551234");
    assert.equal(rate, 0.00010, "longest prefix (1416) should win");
  });

  await test("longest-prefix-wins: +44 vs +447", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90008, "44", 0.00040);
    await insertClientRate(90008, "447", 0.00035);

    const rate = await lookupClientRate("+447911123456", 90008, schemaName);
    assert.equal(rate, 0.00035, "longest prefix (447) should win over 44");
  });

  await test("longest-prefix-wins: three levels", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90009, "44", 0.00050);
    await insertClientRate(90009, "447", 0.00040);
    await insertClientRate(90009, "4479", 0.00030);

    const rate = await lookupClientRate("+447911123456", 90009, schemaName);
    assert.equal(rate, 0.00030, "longest (4479) should win");
  });

  await test("falls back when destination has no matching country prefix", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90010, "44", 0.00050);

    const rate = await lookupClientRate("+999123456789", 90010, schemaName);
    assert.equal(rate, 0.00010, "should fall back to default 0.00010");
  });
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE 2: lookupClientRate — edge cases
// ═══════════════════════════════════════════════════════════

async function suiteClientRateEdgeCases() {
  console.log("\n── lookupClientRate: Edge Cases ──");

  await test("returns default when no rates exist for client", async () => {
    const { schemaName } = await getTestContext();
    const rate = await lookupClientRate("+8801712345678", 99999, schemaName);
    assert.equal(rate, 0.00010, "default rate when no client_rates configured");
  });

  await test("returns default when all rates are inactive", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90011, "880", 0.00050, false); // isActive = false

    const rate = await lookupClientRate("+8801712345678", 90011, schemaName);
    assert.equal(rate, 0.00010, "inactive rate should be ignored, fall back to default");
  });

  await test("skips inactive rates and uses active one", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90012, "880", 0.00050, false);  // inactive
    await insertClientRate(90012, "880", 0.00060, true);   // active

    const rate = await lookupClientRate("+8801712345678", 90012, schemaName);
    assert.equal(rate, 0.00060, "should use active rate, skip inactive");
  });

  await test("empty destination returns default", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90013, "880", 0.00050);

    const rate = await lookupClientRate("", 90013, schemaName);
    assert.equal(rate, 0.00010, "empty dest should return default");
  });

  await test("destination with only + returns default", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90014, "1", 0.00030);

    const rate = await lookupClientRate("+", 90014, schemaName);
    assert.equal(rate, 0.00010, "+ only should return default");
  });

  await test("handles very short destination (1 digit)", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90015, "1", 0.00020);

    const rate = await lookupClientRate("+1", 90015, schemaName);
    assert.equal(rate, 0.00020, "single-digit prefix should match");
  });

  await test("handles destination with spaces (spaces don't break LIKE matching)", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90016, "880", 0.00050);

    // After stripping +, "880 1712 345678" LIKE "880%" is TRUE — spaces are just characters
    const rate = await lookupClientRate("+880 1712 345678", 90016, schemaName);
    assert.equal(rate, 0.00050, "+880 with spaces still matches 880 prefix");
  });

  await test("isolation: different clients have different rates", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90017, "880", 0.00030);
    await insertClientRate(90018, "880", 0.00090);

    const rate1 = await lookupClientRate("+8801712345678", 90017, schemaName);
    const rate2 = await lookupClientRate("+8801712345678", 90018, schemaName);
    assert.equal(rate1, 0.00030, "client 90017 rate");
    assert.equal(rate2, 0.00090, "client 90018 rate");
  });
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE 3: lookupSupplierCost — prefix matching
// ═══════════════════════════════════════════════════════════

async function suiteSupplierCostPrefixMatch() {
  console.log("\n── lookupSupplierCost: Prefix Matching ──");

  await test("matches +880 prefix (Bangladesh)", async () => {
    const { schemaName } = await getTestContext();
    await insertSupplierRate(90001, "880", 0.00040);

    const cost = await lookupSupplierCost("+8801712345678", 90001, schemaName);
    assertClose(cost, 0.00040, 0.000001, "cost for +8801712...");
  });

  await test("matches 254 prefix without leading +", async () => {
    const { schemaName } = await getTestContext();
    await insertSupplierRate(90002, "254", 0.00065);

    const cost = await lookupSupplierCost("254712345678", 90002, schemaName);
    assertClose(cost, 0.00065, 0.000001, "cost for 254712...");
  });

  await test("longest-prefix-wins: +1 vs +1416", async () => {
    const { schemaName } = await getTestContext();
    await insertSupplierRate(90003, "1", 0.00015);
    await insertSupplierRate(90003, "1416", 0.00008);

    const cost = await lookupSupplierCost("+14165551234", 90003, schemaName);
    assert.equal(cost, 0.00008, "longest prefix (1416) should win");
  });

  await test("falls back to default when no matching prefix", async () => {
    const { schemaName } = await getTestContext();
    await insertSupplierRate(90004, "44", 0.00040);

    const cost = await lookupSupplierCost("+999123456789", 90004, schemaName);
    assert.equal(cost, 0.00020, "default supplier cost (0.00020)");
  });

  await test("returns default when no rates exist for supplier", async () => {
    const { schemaName } = await getTestContext();
    const cost = await lookupSupplierCost("+8801712345678", 99999, schemaName);
    assert.equal(cost, 0.00020, "default cost when no supplier_rates configured");
  });

  await test("skips inactive supplier rates", async () => {
    const { schemaName } = await getTestContext();
    await insertSupplierRate(90005, "880", 0.00040, false); // inactive
    await insertSupplierRate(90005, "880", 0.00050, true);  // active

    const cost = await lookupSupplierCost("+8801712345678", 90005, schemaName);
    assert.equal(cost, 0.00050, "should use active supplier rate");
  });

  await test("isolation: different suppliers have different costs", async () => {
    const { schemaName } = await getTestContext();
    await insertSupplierRate(90006, "880", 0.00030);
    await insertSupplierRate(90007, "880", 0.00070);

    const cost1 = await lookupSupplierCost("+8801712345678", 90006, schemaName);
    const cost2 = await lookupSupplierCost("+8801712345678", 90007, schemaName);
    assert.equal(cost1, 0.00030, "supplier 90006 cost");
    assert.equal(cost2, 0.00070, "supplier 90007 cost");
  });
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE 4: Concurrent lookups & connection pool
// ═══════════════════════════════════════════════════════════

async function suiteConcurrent() {
  console.log("\n── Concurrent Lookups ──");

  await test("concurrent rate lookups work without pool exhaustion", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90030, "880", 0.00030);
    await insertClientRate(90030, "1", 0.00020);
    await insertClientRate(90030, "254", 0.00070);

    const destinations = [
      "+8801712345678",
      "+14165551234",
      "+254712345678",
      "8801912345678",
      "14165559876",
      "254723456789",
    ];

    const results = await Promise.all(
      destinations.map((dest) => lookupClientRate(dest, 90030, schemaName))
    );

    // All should return valid values (no errors)
    assert.equal(results.length, 6, "6 concurrent lookups");
    for (const r of results) {
      assert.ok(typeof r === "number" && r > 0, `result should be a positive number, got ${r}`);
    }

    // First 3 should match exact prefixes, last 3 also match (same prefixes without +)
    assert.equal(results[0], 0.00030, "+880... → 0.00030");
    assert.equal(results[1], 0.00020, "+1416... → 0.00020");
    assert.equal(results[2], 0.00070, "+254... → 0.00070");
    assert.equal(results[3], 0.00030, "880... (no +) → 0.00030");
    assert.equal(results[4], 0.00020, "1416... (no +) → 0.00020");
    assert.equal(results[5], 0.00070, "254... (no +) → 0.00070");
  });

  await test("mixed client and supplier concurrent lookups", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90031, "251", 0.00055);
    await insertSupplierRate(90031, "251", 0.00035);

    const [clientRate, supplierCost] = await Promise.all([
      lookupClientRate("+251974726782", 90031, schemaName),
      lookupSupplierCost("+251974726782", 90031, schemaName),
    ]);

    assert.equal(clientRate, 0.00055, "client rate for +251");
    assert.equal(supplierCost, 0.00035, "supplier cost for +251");
  });
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE 5: Multi-country prefix scenarios
// ═══════════════════════════════════════════════════════════

async function suiteMultiCountry() {
  console.log("\n── Multi-Country Prefix Scenarios ──");

  await test("correctly distinguishes +91 (India) from +1 (US)", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90040, "91", 0.00060);
    await insertClientRate(90040, "1", 0.00020);

    const rateIndia = await lookupClientRate("+919876543210", 90040, schemaName);
    const rateUS = await lookupClientRate("+12125551234", 90040, schemaName);

    assert.equal(rateIndia, 0.00060, "India (+91)");
    assert.equal(rateUS, 0.00020, "US (+1)");
  });

  await test("correctly distinguishes +971 (UAE) from +97 (shared prefix)", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90041, "971", 0.00020);
    await insertClientRate(90041, "97", 0.00010);

    // +971501234567 should match 971 (length 3) over 97 (length 2)
    const rate = await lookupClientRate("+971501234567", 90041, schemaName);
    assert.equal(rate, 0.00020, "longest match (971) wins");
  });

  await test("correctly distinguishes +7 (Russia) from +77 (Kazakhstan)", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90042, "7", 0.00030);
    await insertClientRate(90042, "77", 0.00025);

    const rateRu = await lookupClientRate("+79161234567", 90042, schemaName);
    const rateKz = await lookupClientRate("+77771234567", 90042, schemaName);

    assert.equal(rateRu, 0.00030, "Russia (+79 → matches 7)");  // +79 doesn't match +77
    assert.equal(rateKz, 0.00025, "Kazakhstan (+77 → matches 77)");
  });

  await test("handles +39 (Italy) and +390 (specific)", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90043, "39", 0.00030);
    await insertClientRate(90043, "390", 0.00025);

    const rate390 = await lookupClientRate("+390123456789", 90043, schemaName);
    assert.equal(rate390, 0.00025, "longest (390) should win for +390...");
  });
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE 6: operator_name column persistence
// ═══════════════════════════════════════════════════════════

async function suiteOperatorNamePersistence() {
  console.log("\n── operator_name: INSERT & SELECT Persistence ──");

  await test("INSERT with operator_name stores it correctly in client_rates", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90050, "880", 0.00050, true, "470", "01", "GrameenPhone");

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      const { rows } = await client.query(
        "SELECT operator_name FROM client_rates WHERE client_id = $1 AND mcc = $2",
        [90050, "470"]
      );
      assert.equal(rows.length, 1, "row should exist");
      assert.equal(rows[0].operator_name, "GrameenPhone", "operator_name persisted correctly");
    } finally {
      await client.query("SET search_path TO public");
      client.release();
    }
  });

  await test("INSERT with operator_name stores it correctly in supplier_rates", async () => {
    const { schemaName } = await getTestContext();
    await insertSupplierRate(90050, "880", 0.00040, true, "470", "01", "GrameenPhone");

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      const { rows } = await client.query(
        "SELECT operator_name FROM supplier_rates WHERE supplier_id = $1 AND mcc = $2",
        [90050, "470"]
      );
      assert.equal(rows.length, 1, "row should exist");
      assert.equal(rows[0].operator_name, "GrameenPhone", "operator_name persisted correctly");
    } finally {
      await client.query("SET search_path TO public");
      client.release();
    }
  });

  await test("INSERT without operator_name stores NULL", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90051, "254", 0.00070, true, "639", "02");

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      const { rows } = await client.query(
        "SELECT operator_name FROM client_rates WHERE client_id = $1",
        [90051]
      );
      assert.equal(rows.length, 1, "row should exist");
      assert.equal(rows[0].operator_name, null, "operator_name should be NULL when not provided");
    } finally {
      await client.query("SET search_path TO public");
      client.release();
    }
  });

  await test("operator_name does not affect rate lookup — rate still matches", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90052, "880", 0.00050, true, "470", "01", "GrameenPhone");

    const rate = await lookupClientRate("+8801712345678", 90052, schemaName);
    assert.equal(rate, 0.00050, "rate lookup works regardless of operator_name");
  });

  await test("operator_name with special characters persists correctly", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90053, "86", 0.00030, true, "460", "00", "中国移动 (China Mobile)");

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      const { rows } = await client.query(
        "SELECT operator_name FROM client_rates WHERE client_id = $1",
        [90053]
      );
      assert.equal(rows.length, 1, "row should exist");
      assert.equal(rows[0].operator_name, "中国移动 (China Mobile)", "unicode operator_name persisted");
    } finally {
      await client.query("SET search_path TO public");
      client.release();
    }
  });

  await test("multiple rates for same client have correct operator_names", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90054, "880", 0.00050, true, "470", "01", "GrameenPhone");
    await insertClientRate(90054, "880", 0.00045, true, "470", "02", "Robi");
    await insertClientRate(90054, "880", 0.00040, true, "470", "03", "Banglalink");

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      const { rows } = await client.query(
        "SELECT mnc, operator_name FROM client_rates WHERE client_id = $1 ORDER BY mnc",
        [90054]
      );
      assert.equal(rows.length, 3, "three rates for client 90054");
      assert.equal(rows[0].operator_name, "GrameenPhone");
      assert.equal(rows[1].operator_name, "Robi");
      assert.equal(rows[2].operator_name, "Banglalink");
    } finally {
      await client.query("SET search_path TO public");
      client.release();
    }
  });

  await test("UPDATE operator_name via direct SQL", async () => {
    const { schemaName } = await getTestContext();
    await insertClientRate(90055, "880", 0.00050, true, "470", "01", "GP");

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      await client.query(
        "UPDATE client_rates SET operator_name = $1 WHERE client_id = $2",
        ["GrameenPhone (updated)", 90055]
      );
      const { rows } = await client.query(
        "SELECT operator_name FROM client_rates WHERE client_id = $1",
        [90055]
      );
      assert.equal(rows[0].operator_name, "GrameenPhone (updated)", "operator_name updated correctly");
    } finally {
      await client.query("SET search_path TO public");
      client.release();
    }
  });
}

// ═══════════════════════════════════════════════════════════
// Run all suites
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log("Rate Lookup Integration Tests");
  console.log("═════════════════════════════");

  try {
    await getTestContext();
  } catch (err) {
    console.error("  ❌ Cannot connect to database:", (err as Error).message);
    console.error("  Make sure PostgreSQL is running and DATABASE_URL is set.");
    process.exit(1);
  }

  await suiteClientRatePrefixMatch();
  await suiteClientRateEdgeCases();
  await suiteSupplierCostPrefixMatch();
  await suiteConcurrent();
  await suiteMultiCountry();
  await suiteOperatorNamePersistence();

  // Final cleanup
  await clearRates();

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
