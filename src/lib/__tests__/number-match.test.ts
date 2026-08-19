/**
 * Unit tests for the Number Translation match-pattern builder
 * (src/lib/number-match.ts).
 *
 * These are pure unit tests — no database or external dependencies required.
 *
 * Covers: deriving the stored match_pattern from a rule name so a country
 * prefix (e.g. "0091") matches that country in all three dialing forms
 * (0091…/+91…/91…) — and only that country — while a non-numeric name falls
 * back to a global match-all ("^.*$").
 *
 * Run:  npx tsx src/lib/__tests__/number-match.test.ts
 */
import assert from "node:assert/strict";
import { matchPatternForName, matchPrefixesForName } from "@/lib/number-match";

// ── Test runner ──

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}: ${(err as Error).message}`);
  }
}

// Does the built pattern match the given destination?
function matches(pattern: string, dest: string): boolean {
  return new RegExp(pattern, "m").test(dest);
}

// ═══════════════════════════════════════════════════════════
// Prefix expansion
// ═══════════════════════════════════════════════════════════

async function suitePrefixExpansion() {
  console.log("\n── Prefix expansion ──");
  await test('"0091" expands to all three dialing forms', () => {
    assert.deepEqual(matchPrefixesForName("0091"), ["0091", "+91", "91"]);
  });
  await test('"+880" expands to all three dialing forms', () => {
    assert.deepEqual(matchPrefixesForName("+880"), ["00880", "+880", "880"]);
  });
  await test('"00880" expands to all three dialing forms', () => {
    assert.deepEqual(matchPrefixesForName("00880"), ["00880", "+880", "880"]);
  });
  await test('"91" (bare) expands to all three dialing forms', () => {
    assert.deepEqual(matchPrefixesForName("91"), ["0091", "+91", "91"]);
  });
  await test("trims surrounding whitespace", () => {
    assert.deepEqual(matchPrefixesForName("  0091  "), ["0091", "+91", "91"]);
  });
  await test("non-numeric names return null (fall back to global)", () => {
    assert.equal(matchPrefixesForName("Sample Number Strip"), null);
    assert.equal(matchPrefixesForName("Number Rule 1"), null);
    assert.equal(matchPrefixesForName(""), null);
  });
  await test('"00" alone (no country code) returns null', () => {
    assert.equal(matchPrefixesForName("00"), null);
  });
}

// ═══════════════════════════════════════════════════════════
// Built pattern behaviour
// ═══════════════════════════════════════════════════════════

async function suiteBuiltPatternBehaviour() {
  console.log("\n── Built pattern behaviour ──");
  await test('"0091" pattern matches 0091… / +91… / 91… only', () => {
    const p = matchPatternForName("0091");
    assert.ok(matches(p, "00911234567890"));
    assert.ok(matches(p, "+911234567890"));
    assert.ok(matches(p, "911234567890"));
    assert.ok(!matches(p, "008801812345678")); // Bangladesh must NOT match
    assert.ok(!matches(p, "8613800138000")); // China must NOT match
  });
  await test('"00880" pattern matches Bangladesh only', () => {
    const p = matchPatternForName("00880");
    assert.ok(matches(p, "008801812345678"));
    assert.ok(matches(p, "+8801812345678"));
    assert.ok(matches(p, "8801812345678"));
    assert.ok(!matches(p, "00911234567890"));
  });
  await test("non-numeric name falls back to match-all", () => {
    const p = matchPatternForName("Sample Number Strip");
    assert.equal(p, "^.*$");
    assert.ok(matches(p, "00911234567890"));
    assert.ok(matches(p, "008801812345678"));
  });
}

// ═══════════════════════════════════════════════════════════
// Run all suites
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log("Number Translation Match-Pattern Tests");
  console.log("═══════════════════════════════════════");

  await suitePrefixExpansion();
  await suiteBuiltPatternBehaviour();

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
