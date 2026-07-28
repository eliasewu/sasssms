/**
 * Unit tests for shared ID generators (src/lib/id-generators.ts).
 *
 * These are pure unit tests — no database or external dependencies required.
 *
 * Covers:
 *  1. genCode — format, length, uniqueness
 *  2. genId   — format, length, uniqueness
 *  3. genPwd  — format, length, charset, uniqueness
 *
 * Run:  npx tsx src/lib/__tests__/id-generators.test.ts
 */
import assert from "node:assert/strict";
import { genCode, genId, genPwd } from "@/lib/id-generators";

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

// ═══════════════════════════════════════════════════════════
// TEST SUITE 1: genCode — format & constraints
// ═══════════════════════════════════════════════════════════

async function suiteGenCode() {
  console.log("\n── genCode: Format & Constraints ──");

  await test("starts with QS_ prefix", () => {
    for (let i = 0; i < 20; i++) {
      const code = genCode();
      assert.ok(code.startsWith("QS_"), `expected QS_ prefix but got: ${code}`);
    }
  });

  await test("has exactly 9 characters (QS_ + 6)", () => {
    for (let i = 0; i < 20; i++) {
      assert.equal(genCode().length, 9, "genCode should always be 9 chars");
    }
  });

  await test("contains only uppercase alphanumeric after prefix", () => {
    for (let i = 0; i < 20; i++) {
      const suffix = genCode().slice(3);
      assert.ok(/^[A-Z0-9]{6}$/.test(suffix), `invalid suffix: ${suffix}`);
    }
  });

  await test("generates unique values across 1000 calls", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i++) codes.add(genCode());
    assert.equal(codes.size, 1000, "all 1000 codes should be unique");
  });

  await test("returns a string", () => {
    assert.equal(typeof genCode(), "string");
  });
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE 2: genId — format & constraints
// ═══════════════════════════════════════════════════════════

async function suiteGenId() {
  console.log("\n── genId: Format & Constraints ──");

  await test("starts with gsm_ prefix", () => {
    for (let i = 0; i < 20; i++) {
      const id = genId();
      assert.ok(id.startsWith("gsm_"), `expected gsm_ prefix but got: ${id}`);
    }
  });

  await test("has exactly 10 characters (gsm_ + 6)", () => {
    for (let i = 0; i < 20; i++) {
      assert.equal(genId().length, 10, "genId should always be 10 chars");
    }
  });

  await test("contains only lowercase alphanumeric after prefix", () => {
    for (let i = 0; i < 20; i++) {
      const suffix = genId().slice(4);
      assert.ok(/^[a-z0-9]{6}$/.test(suffix), `invalid suffix: ${suffix}`);
    }
  });

  await test("generates unique values across 1000 calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) ids.add(genId());
    assert.equal(ids.size, 1000, "all 1000 ids should be unique");
  });

  await test("returns a string", () => {
    assert.equal(typeof genId(), "string");
  });
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE 3: genPwd — format, charset & constraints
// ═══════════════════════════════════════════════════════════

async function suiteGenPwd() {
  console.log("\n── genPwd: Format, Charset & Constraints ──");

  const VALID_CHARS = new Set(
    "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  );

  await test("has exactly 12 characters", () => {
    for (let i = 0; i < 20; i++) {
      assert.equal(genPwd().length, 12, "genPwd should always be 12 chars");
    }
  });

  await test("uses only characters from allowed charset", () => {
    for (let i = 0; i < 50; i++) {
      const pwd = genPwd();
      for (const ch of pwd) {
        assert.ok(VALID_CHARS.has(ch), `invalid character '${ch}' in password: ${pwd}`);
      }
    }
  });

  await test("never contains ambiguous characters (I, l, O, 0, 1)", () => {
    const ambiguous = new Set(["I", "l", "O", "0", "1"]);
    for (let i = 0; i < 100; i++) {
      const pwd = genPwd();
      for (const ch of pwd) {
        assert.ok(
          !ambiguous.has(ch),
          `ambiguous character '${ch}' found in password: ${pwd}`
        );
      }
    }
  });

  await test("contains no whitespace or special characters", () => {
    for (let i = 0; i < 50; i++) {
      const pwd = genPwd();
      assert.ok(/^[a-zA-Z0-9]+$/.test(pwd), `invalid characters in: ${pwd}`);
    }
  });

  await test("generates unique values across 5000 calls", () => {
    const pwds = new Set<string>();
    for (let i = 0; i < 5000; i++) pwds.add(genPwd());
    assert.equal(pwds.size, 5000, "all 5000 passwords should be unique");
  });

  await test("returns a string", () => {
    assert.equal(typeof genPwd(), "string");
  });

  await test("contains at least one lowercase, one uppercase, and one digit (on average)", () => {
    // Probabilistic: run many samples and verify diversity
    // Charset: 24 lower + 24 upper + 8 digits = 56 chars
    // P(at least one digit in 12) ≈ 84%, so 80/100 threshold is safe
    let hasLower = 0, hasUpper = 0, hasDigit = 0;
    for (let i = 0; i < 100; i++) {
      const pwd = genPwd();
      if (/[a-z]/.test(pwd)) hasLower++;
      if (/[A-Z]/.test(pwd)) hasUpper++;
      if (/[0-9]/.test(pwd)) hasDigit++;
    }
    assert.ok(hasLower >= 95, `only ${hasLower}/100 have lowercase`);
    assert.ok(hasUpper >= 95, `only ${hasUpper}/100 have uppercase`);
    assert.ok(hasDigit >= 80, `only ${hasDigit}/100 have digits`);
  });

  await test("can produce every character in the 56-char charset across many calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      for (const ch of genPwd()) seen.add(ch);
    }
    assert.equal(seen.size, 56, `expected all 56 charset chars, got ${seen.size} (missing: ${[...VALID_CHARS].filter(c => !seen.has(c)).join("")})`);
  });
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE 4: Cross-function independence
// ═══════════════════════════════════════════════════════════

async function suiteCrossFunction() {
  console.log("\n── Cross-function Independence ──");

  await test("genCode, genId, genPwd produce values in different formats", () => {
    const code = genCode();
    const id = genId();
    const pwd = genPwd();

    assert.notEqual(code, id, "code and id should differ");
    assert.notEqual(code, pwd, "code and pwd should differ");
    assert.notEqual(id, pwd, "id and pwd should differ");

    // Verify distinct prefixes
    assert.ok(code.startsWith("QS_"), "code prefix");
    assert.ok(id.startsWith("gsm_"), "id prefix");
    assert.ok(!pwd.startsWith("QS_") && !pwd.startsWith("gsm_"), "pwd has no known prefix");
  });

  await test("calling multiple generators in rapid succession doesn't interfere", () => {
    const results = Array.from({ length: 50 }, () => ({
      code: genCode(),
      id: genId(),
      pwd: genPwd(),
    }));

    for (const r of results) {
      assert.equal(r.code.length, 9);
      assert.equal(r.id.length, 10);
      assert.equal(r.pwd.length, 12);
    }
  });
}

// ═══════════════════════════════════════════════════════════
// Run all suites
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log("id-generators Unit Tests");
  console.log("═════════════════════════");

  await suiteGenCode();
  await suiteGenId();
  await suiteGenPwd();
  await suiteCrossFunction();

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
