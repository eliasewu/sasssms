/**
 * End-to-end test: Random SID translation with MCC/MNC filtering
 * 
 * Tests that:
 * 1. A random SID rule with MCC=470 MNC=007 (Bangladesh Airtel) matches a BD number
 * 2. The same rule does NOT match an India number (MCC=404)
 * 3. Global rules (no MCC/MNC) match any destination
 * 
 * Usage: npx tsx scripts/test-random-sid-mccmnc.ts
 */
import { pool } from "@/db";
import { tenantQuery } from "@/lib/tenant-schema";
import { applyEntityTranslations } from "@/lib/translation-engine";

async function main() {
  console.log("=== Random SID MCC/MNC Translation Test ===\n");

  // 1. Find a tenant and supplier
  const { rows: tenants } = await pool.query(
    "SELECT id, schema_name, company_name FROM tenants WHERE is_active = true LIMIT 1"
  );
  if (tenants.length === 0) {
    console.error("No active tenants found");
    process.exit(1);
  }
  const t = tenants[0];
  console.log(`Using tenant: ${t.company_name} (schema: ${t.schema_name})`);

  // Find a supplier
  const { rows: suppliers } = await tenantQuery(
    t.schema_name,
    "SELECT id, name FROM suppliers WHERE is_active = true LIMIT 1"
  );
  if (suppliers.length === 0) {
    console.error("No active suppliers found in tenant");
    process.exit(1);
  }
  const supplier = suppliers[0];
  console.log(`Using supplier: #${supplier.id} ${supplier.name}\n`);

  // 2. Create a test Random SID rule for Bangladesh Airtel (470/007)
  console.log("--- Creating test Random SID rule ---");
  await tenantQuery(t.schema_name,
    `DELETE FROM translation_pool_items WHERE profile_id IN 
     (SELECT id FROM translation_profiles WHERE name = 'TEST_RANDOM_SID_BD_AIRTEL')`
  );
  await tenantQuery(t.schema_name,
    `DELETE FROM translation_assignments WHERE profile_id IN
     (SELECT id FROM translation_profiles WHERE name = 'TEST_RANDOM_SID_BD_AIRTEL')`
  );
  await tenantQuery(t.schema_name,
    `DELETE FROM translation_profiles WHERE name = 'TEST_RANDOM_SID_BD_AIRTEL'`
  );

  const { rows: [profile] } = await tenantQuery(
    t.schema_name,
    `INSERT INTO translation_profiles (name, target_field, mode, category, match_pattern, mcc, mnc, is_active)
     VALUES ($1, 'SENDER', 'RANDOM', 'RANDOM_SID', '.*', '470', '007', true) RETURNING *`,
    ['TEST_RANDOM_SID_BD_AIRTEL']
  );
  console.log(`  ✓ Created profile #${profile.id}: ${profile.name} (MCC=${profile.mcc}, MNC=${profile.mnc})`);

  // Add pool items
  const poolSenders = ['BD_Airtel_SID1', 'BD_Airtel_SID2', 'BD_Airtel_SID3'];
  for (const sid of poolSenders) {
    await tenantQuery(t.schema_name,
      `INSERT INTO translation_pool_items (profile_id, replacement_value) VALUES ($1, $2)`,
      [profile.id, sid]
    );
  }
  console.log(`  ✓ Added ${poolSenders.length} random sender IDs to pool: [${poolSenders.join(', ')}]`);

  // Assign to the supplier
  await tenantQuery(t.schema_name,
    `INSERT INTO translation_assignments (profile_id, supplier_id, priority, is_active) VALUES ($1, $2, 1, true)`,
    [profile.id, supplier.id]
  );
  console.log(`  ✓ Assigned to supplier #${supplier.id}\n`);

  // 3. Test with matching destination (Bangladesh Airtel: +8801615069178)
  console.log("--- Test 1: Matching destination (Bangladesh Airtel: +8801615069178) ---");
  const bdNumber = "+8801615069178";
  const result1 = await applyEntityTranslations(
    t.schema_name, "supplier", supplier.id,
    "OriginalSender", bdNumber, "Test message"
  );
  console.log(`  Sender: "${result1.sender}"`);
  console.log(`  Applied profiles: [${result1.appliedNames.join(', ') || 'NONE'}]`);
  const bdMatched = result1.appliedNames.includes('TEST_RANDOM_SID_BD_AIRTEL');
  console.log(`  Result: ${bdMatched ? '✅ MATCHED' : '❌ NOT MATCHED'} (should MATCH — BD Airtel is MCC=470 MNC=007)\n`);

  // 4. Test with non-matching destination (India: +919876543210)
  console.log("--- Test 2: Non-matching destination (India: +919876543210) ---");
  const inNumber = "+919876543210";
  const result2 = await applyEntityTranslations(
    t.schema_name, "supplier", supplier.id,
    "OriginalSender", inNumber, "Test message"
  );
  console.log(`  Sender: "${result2.sender}"`);
  console.log(`  Applied profiles: [${result2.appliedNames.join(', ') || 'NONE'}]`);
  const inMatched = result2.appliedNames.includes('TEST_RANDOM_SID_BD_AIRTEL');
  console.log(`  Result: ${inMatched ? '❌ INCORRECTLY MATCHED' : '✅ NOT MATCHED'} (should NOT match — India is MCC=404/405)\n`);

  // 5. Test with a global rule (no MCC/MNC)
  console.log("--- Test 3: Global rule (no MCC/MNC) ---");
  await tenantQuery(t.schema_name,
    `DELETE FROM translation_assignments WHERE profile_id = $1`,
    [profile.id]
  );
  // Make the BD rule global
  await tenantQuery(t.schema_name,
    `UPDATE translation_profiles SET mcc = NULL, mnc = NULL WHERE id = $1`,
    [profile.id]
  );
  console.log(`  ✓ Changed BD rule to global (MCC=NULL, MNC=NULL)`);

  // Re-assign
  await tenantQuery(t.schema_name,
    `INSERT INTO translation_assignments (profile_id, supplier_id, priority, is_active) VALUES ($1, $2, 1, true)`,
    [profile.id, supplier.id]
  );

  const result3 = await applyEntityTranslations(
    t.schema_name, "supplier", supplier.id,
    "OriginalSender", inNumber, "Test message"
  );
  console.log(`  Sender: "${result3.sender}"`);
  console.log(`  Applied profiles: [${result3.appliedNames.join(', ') || 'NONE'}]`);
  const globalMatched = result3.appliedNames.includes('TEST_RANDOM_SID_BD_AIRTEL');
  console.log(`  Result: ${globalMatched ? '✅ MATCHED' : '❌ NOT MATCHED'} (should MATCH — global rules apply to any destination)\n`);

  // 6. Cleanup
  await tenantQuery(t.schema_name,
    `DELETE FROM translation_pool_items WHERE profile_id = $1`,
    [profile.id]
  );
  await tenantQuery(t.schema_name,
    `DELETE FROM translation_assignments WHERE profile_id = $1`,
    [profile.id]
  );
  await tenantQuery(t.schema_name,
    `DELETE FROM translation_profiles WHERE id = $1`,
    [profile.id]
  );
  console.log("--- Cleanup complete ---");

  // Summary
  console.log("\n=== RESULTS ===");
  console.log(`MCC/MNC filtering: ${bdMatched ? '✅' : '❌'} Matching destination gets random SID`);
  console.log(`Non-matching skip:  ${!inMatched ? '✅' : '❌'} Non-matching destination skipped`);
  console.log(`Global rules:       ${globalMatched ? '✅' : '❌'} Global rules apply to any destination`);
  
  const allPassed = bdMatched && !inMatched && globalMatched;
  console.log(`\n${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  await pool.end();
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error("Test failed:", err);
  pool.end();
  process.exit(1);
});
