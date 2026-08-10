/**
 * Unit tests for the SMS submission dedupe helper (sms-dedupe.ts).
 *
 * Run: npx tsx src/lib/__tests__/sms-dedupe.test.ts
 */
import assert from "node:assert";
import { isDuplicateSmsSubmission, releaseSmsSubmission, clearSmsDedupe } from "../sms-dedupe";

function check() {
  const base = {
    schemaName: "tenant_test_1",
    clientId: 7,
    sender: "Net2APP",
    destination: "971509607882",
    content: "Hello duplicate test",
  };

  // 1. First submission is never a duplicate
  assert.strictEqual(isDuplicateSmsSubmission(base), false, "first submit must pass");

  // 2. Identical repeat within the window IS a duplicate
  assert.strictEqual(isDuplicateSmsSubmission({ ...base }), true, "identical repeat must be skipped");

  // 3. Different destination is NOT a duplicate
  assert.strictEqual(
    isDuplicateSmsSubmission({ ...base, destination: "971509607883" }),
    false,
    "different destination must pass"
  );

  // 4. Different content is NOT a duplicate
  assert.strictEqual(
    isDuplicateSmsSubmission({ ...base, content: "different body" }),
    false,
    "different content must pass"
  );

  // 5. Same content/destination under a different client IS allowed
  assert.strictEqual(
    isDuplicateSmsSubmission({ ...base, clientId: 8 }),
    false,
    "different client must pass"
  );

  // 6. Same content/destination under a different tenant schema IS allowed
  assert.strictEqual(
    isDuplicateSmsSubmission({ ...base, schemaName: "tenant_test_2" }),
    false,
    "different schema must pass"
  );

  // 7. releaseSmsSubmission clears the marker — a retry after a FAILED send passes
  assert.strictEqual(isDuplicateSmsSubmission({ ...base, schemaName: "tenant_test_2" }), true, "re-mark before release");
  releaseSmsSubmission({ ...base, schemaName: "tenant_test_2" });
  assert.strictEqual(
    isDuplicateSmsSubmission({ ...base, schemaName: "tenant_test_2" }),
    false,
    "after release, same submission must pass again"
  );

  console.log("✅ sms-dedupe: all assertions passed");
}

clearSmsDedupe();
check();
