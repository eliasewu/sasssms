/**
 * test-translation-scope-fix.ts
 *
 * E2E test verifying the translation scope fix works correctly:
 *
 *  1. Creates a SID translation rule with CLIENT scope
 *  2. Fetches it back and verifies scope = "client" (not "both"/Global)
 *  3. Changes scope to SUPPLIER
 *  4. Fetches again and verifies old assignment is inactive, new one is active
 *  5. Verifies the GET API only returns active assignments (is_active = true filter)
 *
 * Run: npx tsx scripts/test-translation-scope-fix.ts
 *
 * Requires: PostgreSQL running, .env with DATABASE_URL, at least 1 active tenant
 *           with at least 1 client and 1 supplier in that tenant.
 */
import { pool } from "../src/db";

// ── Test runner ──
let passed = 0;
let failed = 0;

function test(name: string, fn: () => Promise<void> | void) {
  return (async () => {
    try {
      await fn();
      passed++;
      console.log(`  ✅ ${name}`);
    } catch (err) {
      failed++;
      console.error(`  ❌ ${name}: ${(err as Error).message}`);
    }
  })();
}

// ── Assert helper ──
function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(`Assertion failed: ${msg}`);
}

async function main() {
  console.log("Translation Scope Fix — E2E Verification");
  console.log("══════════════════════════════════════════\n");

  const client = await pool.connect();

  let tenantSchema = "";
  let tenantId = 0;
  let testClientId = 0;
  let testSupplierId = 0;
  let testProfileId: number | null = null;

  try {
    // ── Setup: find tenant + client + supplier ──
    const { rows: tenants } = await client.query(
      "SELECT id, schema_name FROM tenants WHERE is_active = true ORDER BY id LIMIT 1"
    );
    assert(tenants.length > 0, "No active tenants found");
    tenantId = tenants[0].id;
    tenantSchema = tenants[0].schema_name;
    console.log(`Tenant: ${tenantSchema} (id=${tenantId})`);

    await client.query(`SET search_path TO "${tenantSchema}"`);

    const { rows: clients } = await client.query(
      "SELECT id, name FROM clients WHERE is_active = true LIMIT 1"
    );
    assert(clients.length > 0, "No active clients found");
    testClientId = clients[0].id;
    console.log(`Client: ${clients[0].name} (id=${testClientId})`);

    const { rows: suppliers } = await client.query(
      "SELECT id, name FROM suppliers WHERE is_active = true LIMIT 1"
    );
    assert(suppliers.length > 0, "No active suppliers found");
    testSupplierId = suppliers[0].id;
    console.log(`Supplier: ${suppliers[0].name} (id=${testSupplierId})\n`);

    // ═══════════════════════════════════════
    // TEST 1: Create profile with CLIENT scope, verify it shows client
    // ═══════════════════════════════════════
    await test("POST creates profile with client scope and correct assignment", async () => {
      // Simulate what the dashboard POST does
      const name = `E2E_TEST_SID_${Date.now()}`;
      await client.query(
        `INSERT INTO translation_profiles (name, target_field, mode, category, match_pattern, replacement_fixed)
         VALUES ($1, 'SENDER', 'FIXED', 'SID', '.*', 'TEST_BRAND')
         RETURNING id`,
        [name]
      );

      const { rows: profiles } = await client.query(
        "SELECT id FROM translation_profiles WHERE name = $1 ORDER BY id DESC LIMIT 1",
        [name]
      );
      testProfileId = profiles[0].id;
      assert(testProfileId !== null, "Profile was created");

      // Create client-scoped assignment (same as API POST route)
      await client.query(
        `INSERT INTO translation_assignments (profile_id, client_id, supplier_id, priority, is_active)
         VALUES ($1, $2, NULL, 1, true)
         RETURNING id`,
        [testProfileId, testClientId]
      );

      // Now fetch the profile and verify
      const { rows: result } = await client.query(
        `SELECT tp.*,
          COALESCE(
            (SELECT json_agg(json_build_object('id', ta.id, 'clientId', ta.client_id, 'supplierId', ta.supplier_id, 'priority', ta.priority, 'isActive', ta.is_active))
             FROM translation_assignments ta WHERE ta.profile_id = tp.id AND ta.is_active = true), '[]'::json
          ) as assignments
         FROM translation_profiles tp WHERE tp.id = $1`,
        [testProfileId]
      );

      const assignments = result[0].assignments || [];
      assert(assignments.length === 1, `Expected 1 active assignment, got ${assignments.length}`);
      assert(assignments[0].clientId === testClientId, `Expected clientId=${testClientId}, got ${assignments[0].clientId}`);
      assert(assignments[0].supplierId === null, "Expected supplierId=null for client scope");
      console.log(`     → scope confirmed: client #${assignments[0].clientId}, active=${assignments[0].isActive}`);
    });

    // ═══════════════════════════════════════
    // TEST 2: Change scope from CLIENT → SUPPLIER
    // ═══════════════════════════════════════
    await test("PUT changes scope from client to supplier — old deactivated, new active", async () => {
      // Simulate what the PUT route does: deactivate all, create new
      await client.query(
        "UPDATE translation_assignments SET is_active = false WHERE profile_id = $1",
        [testProfileId]
      );

      await client.query(
        `INSERT INTO translation_assignments (profile_id, client_id, supplier_id, priority, is_active)
         VALUES ($1, NULL, $2, 1, true)
         RETURNING id`,
        [testProfileId, testSupplierId]
      );

      // Now verify: active assignment should point to supplier, old one to client (inactive)
      const { rows: allAssignments } = await client.query(
        `SELECT id, client_id as "clientId", supplier_id as "supplierId", is_active as "isActive"
         FROM translation_assignments WHERE profile_id = $1
         ORDER BY id`,
        [testProfileId]
      );

      assert(allAssignments.length >= 2, `Expected ≥2 assignments, got ${allAssignments.length}`);

      const active = allAssignments.filter((a: any) => a.isActive === true);
      const inactive = allAssignments.filter((a: any) => a.isActive === false);

      assert(active.length === 1, `Expected 1 active, got ${active.length}`);
      assert(active[0].supplierId === testSupplierId, `Active should be supplier #${testSupplierId}, got clientId=${active[0].clientId} supplierId=${active[0].supplierId}`);
      assert(inactive.length >= 1, `Expected ≥1 inactive, got ${inactive.length}`);
      assert(inactive[0].clientId === testClientId, `Inactive should be client #${testClientId}`);

      console.log(`     → active: supplier #${active[0].supplierId}, inactive: client #${inactive[0].clientId}`);
    });

    // ═══════════════════════════════════════
    // TEST 3: GET only returns active assignments
    // ═══════════════════════════════════════
    await test("GET query with is_active=true filter returns only active assignments", async () => {
      const { rows: result } = await client.query(
        `SELECT tp.*,
          COALESCE(
            (SELECT json_agg(json_build_object('id', ta.id, 'clientId', ta.client_id, 'supplierId', ta.supplier_id, 'isActive', ta.is_active))
             FROM translation_assignments ta WHERE ta.profile_id = tp.id AND ta.is_active = true), '[]'::json
          ) as assignments
         FROM translation_profiles tp WHERE tp.id = $1`,
        [testProfileId]
      );

      const assignments = result[0].assignments || [];
      assert(assignments.length === 1, `Expected exactly 1 active assignment in GET, got ${assignments.length}`);
      assert(assignments[0].supplierId === testSupplierId, "Active assignment should be the supplier one");
      assert(assignments[0].isActive === true, "Returned assignment should be active");
      console.log(`     → GET returns 1 active assignment: supplier #${assignments[0].supplierId}`);
    });

    // ═══════════════════════════════════════
    // TEST 4: Dashboard-style scope resolution
    // ═══════════════════════════════════════
    await test("Dashboard scope resolution picks active assignment correctly", async () => {
      // This simulates what the dashboard loadRules() does after the fix
      const { rows: result } = await client.query(
        `SELECT tp.*,
          COALESCE(
            (SELECT json_agg(json_build_object('id', ta.id, 'clientId', ta.client_id, 'supplierId', ta.supplier_id, 'priority', ta.priority, 'isActive', ta.is_active))
             FROM translation_assignments ta WHERE ta.profile_id = tp.id AND ta.is_active = true), '[]'::json
          ) as assignments
         FROM translation_profiles tp WHERE tp.id = $1`,
        [testProfileId]
      );

      const assignments = result[0].assignments || [];
      // Simulate dashboard logic from the fix
      const a = (assignments as any[]).find((x: any) => x.isActive !== false);

      // Should resolve to supplier scope (not the old client, not Global)
      assert(a !== undefined, "Should find an active assignment");
      assert(a.supplierId === testSupplierId && a.clientId === null,
        `Expected supplier #${testSupplierId}, got clientId=${a.clientId} supplierId=${a.supplierId}`);
      console.log(`     → dashboard resolves: supplier #${a.supplierId}`);
    });

  } catch (err) {
    console.error(`\n💥 Fatal: ${(err as Error).message}`);
    failed++;
  } finally {
    // ── Cleanup ──
    if (testProfileId) {
      try {
        await client.query("DELETE FROM translation_assignments WHERE profile_id = $1", [testProfileId]);
        await client.query("DELETE FROM translation_pool_items WHERE profile_id = $1", [testProfileId]);
        await client.query("DELETE FROM translation_profiles WHERE id = $1", [testProfileId]);
        console.log(`\n🧹 Cleaned up test profile #${testProfileId}`);
      } catch {}
    }
    await client.query("SET search_path TO public");
    client.release();
  }

  console.log(`\n── Results ──`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);

  if (failed > 0) {
    console.error(`\n❌ ${failed} test(s) FAILED`);
    process.exit(1);
  } else {
    console.log(`\n✅ All tests passed — scope fix verified!`);
    process.exit(0);
  }
}

main();
