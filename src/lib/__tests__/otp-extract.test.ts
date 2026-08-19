/**
 * Unit tests for smart OTP auto-detection (src/lib/otp-detect.ts).
 *
 * This is the fallback used whenever a custom extraction regex does not match,
 * so an OTP is still recovered from any message content (e.g. a rule with
 * pattern "Your code is (\d+)" against "Your OTP code is 252525").
 *
 * These are pure unit tests — no database or external dependencies required.
 *
 * Run:  npx tsx src/lib/__tests__/otp-extract.test.ts
 */
import assert from "node:assert/strict";
import { autoDetectOtp } from "@/lib/otp-detect";

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

async function main() {
  console.log("OTP Auto-Detection Tests");
  console.log("════════════════════════");

  await test("extracts a bare 4-8 digit code", () => {
    assert.equal(autoDetectOtp("252525"), "252525");
  });

  await test("extracts code after an OTP keyword (keyword-first)", () => {
    assert.equal(autoDetectOtp("Your OTP code is 252525. Valid for 5 min."), "252525");
  });

  await test("extracts code before a keyword (keyword-after)", () => {
    assert.equal(autoDetectOtp("252525 is your code"), "252525");
  });

  await test("extracts code with a custom-regex-like phrase", () => {
    assert.equal(autoDetectOtp("Your code is 987654. Valid."), "987654");
  });

  await test("returns the first standalone 4-8 digit run", () => {
    assert.equal(autoDetectOtp("Ref 12345678 then 9999"), "12345678");
  });

  await test("returns null when no digits are present", () => {
    assert.equal(autoDetectOtp("Hello, no code here"), null);
  });

  await test("does not treat short digits as a code", () => {
    assert.equal(autoDetectOtp("pin 12 ok"), null);
  });

  console.log(`\n── Results ──`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);

  if (failed > 0) {
    console.error(`\n❌ ${failed} test(s) FAILED`);
    process.exit(1);
  }
  console.log(`\n✅ All tests passed!`);
  process.exit(0);
}

main();
