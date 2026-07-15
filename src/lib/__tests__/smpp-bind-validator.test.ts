/**
 * Integration tests for the SMPP Bind Validator module.
 *
 * Covers:
 *  1. IP whitelist validation — single IPs, comma-separated, IPv4-mapped IPv6, edge cases
 *  2. Password enforcement — match, mismatch, empty/null on both sides
 *  3. Combined validateBind — correct error precedence, null/undefined handling
 *  4. extractRemoteAddress — socket fallback, missing values
 *  5. Success path — valid credentials pass through
 *  6. Both ESME client and supplier SERVER-mode scenarios
 *
 * Run:  npx tsx src/lib/__tests__/smpp-bind-validator.test.ts
 */
import assert from "node:assert/strict";
import {
  validateIpWhitelist,
  validatePassword,
  validateBind,
  extractRemoteAddress,
  SMPP_ESME_RBINDFAIL,
} from "../smpp-bind-validator";

// ── Test helpers ──

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  assert.deepStrictEqual(actual, expected, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertTrue(condition: boolean, label: string): void {
  assert.strictEqual(condition, true, `${label}: expected true, got false`);
}

function assertFalse(condition: boolean, label: string): void {
  assert.strictEqual(condition, false, `${label}: expected false, got true`);
}

// ── Test runner ──

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name}: ${(err as Error).message}`);
  }
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE 1: IP Whitelist Validation
// ═══════════════════════════════════════════════════════════

console.log("\n── IP Whitelist Validation ──");

test("null allowedIp allows all", () => {
  assertTrue(validateIpWhitelist(null, "1.2.3.4"), "null allows");
  assertTrue(validateIpWhitelist(null, "10.0.0.1"), "null allows different IP");
  assertTrue(validateIpWhitelist(null, undefined), "null allows missing remote");
});

test("empty string allowedIp allows all", () => {
  assertTrue(validateIpWhitelist("", "1.2.3.4"), "empty allows");
  assertTrue(validateIpWhitelist("   ", "1.2.3.4"), "whitespace-only allows");
});

test("single IP matches exactly", () => {
  assertTrue(validateIpWhitelist("1.2.3.4", "1.2.3.4"), "exact match");
  assertFalse(validateIpWhitelist("1.2.3.4", "1.2.3.5"), "off-by-one fails");
});

test("comma-separated whitelist matches any entry", () => {
  assertTrue(validateIpWhitelist("1.2.3.4,10.0.0.5,192.168.1.1", "10.0.0.5"), "middle entry matches");
  assertTrue(validateIpWhitelist("1.2.3.4,10.0.0.5,192.168.1.1", "1.2.3.4"), "first entry matches");
  assertTrue(validateIpWhitelist("1.2.3.4,10.0.0.5,192.168.1.1", "192.168.1.1"), "last entry matches");
  assertFalse(validateIpWhitelist("1.2.3.4,10.0.0.5", "8.8.8.8"), "unknown IP rejected");
});

test("comma-separated whitelist with spaces is trimmed", () => {
  assertTrue(validateIpWhitelist(" 1.2.3.4 , 10.0.0.5 , 192.168.1.1 ", "10.0.0.5"), "spaces trimmed");
  assertTrue(validateIpWhitelist("1.2.3.4,  10.0.0.5  ,192.168.1.1", "10.0.0.5"), "mixed whitespace");
});

test("comma-separated with trailing comma or empty entries is handled", () => {
  assertTrue(validateIpWhitelist("1.2.3.4,", "1.2.3.4"), "trailing comma");
  assertTrue(validateIpWhitelist(",1.2.3.4", "1.2.3.4"), "leading comma");
  assertTrue(validateIpWhitelist("1.2.3.4,,10.0.0.5", "10.0.0.5"), "double comma");
});

test("IPv4-mapped IPv6 addresses are normalized", () => {
  assertTrue(validateIpWhitelist("1.2.3.4", "::ffff:1.2.3.4"), "IPv4-mapped matches IPv4");
  assertTrue(validateIpWhitelist("1.2.3.4", "1.2.3.4"), "plain IPv4 still matches");
  assertFalse(validateIpWhitelist("1.2.3.4", "::ffff:1.2.3.5"), "different IPv4-mapped fails");
});

test("missing remoteAddress rejects when whitelist is set", () => {
  assertFalse(validateIpWhitelist("1.2.3.4", undefined), "undefined rejected");
});

test("IPv6 addresses are supported", () => {
  assertTrue(validateIpWhitelist("::1", "::1"), "IPv6 loopback matches");
  assertTrue(validateIpWhitelist("::1,fe80::1", "fe80::1"), "IPv6 in list matches");
  assertFalse(validateIpWhitelist("::1", "::2"), "different IPv6 rejected");
});

test("partial IP match is rejected (not substring)", () => {
  assertFalse(validateIpWhitelist("1.2.3.4", "1.2.3.40"), "substring rejected");
  assertFalse(validateIpWhitelist("1.2.3.4", "1.2.3.4 "), "trailing space in remote");
  assertFalse(validateIpWhitelist("1.2.3.4", " 1.2.3.4"), "leading space in remote");
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 2: Password Validation
// ═══════════════════════════════════════════════════════════

console.log("\n── Password Validation ──");

test("exact password match passes", () => {
  assertTrue(validatePassword("secret123", "secret123"), "exact match");
  assertTrue(validatePassword("p@ssw0rd!", "p@ssw0rd!"), "special chars match");
});

test("password mismatch fails", () => {
  assertFalse(validatePassword("secret", "wrong"), "wrong password");
  assertFalse(validatePassword("Secret", "secret"), "case sensitive fail");
});

test("both null passwords match", () => {
  assertTrue(validatePassword(null, null), "both null");
});

test("DB has password but client sends null — fails", () => {
  assertFalse(validatePassword("secret", null), "DB password vs null client");
});

test("DB has null password but client sends something — fails", () => {
  assertFalse(validatePassword(null, "something"), "null DB vs client password");
});

test("both empty strings match", () => {
  assertTrue(validatePassword("", ""), "both empty");
});

test("DB empty string vs client null — matches (both normalize to '')", () => {
  assertTrue(validatePassword("", null), "empty DB vs null client");
});

test("DB null vs client empty string — matches (both normalize to '')", () => {
  assertTrue(validatePassword(null, ""), "null DB vs empty client");
});

test("DB undefined vs client undefined — matches", () => {
  // undefined is coerced to "" by the || operator
  assertTrue(validatePassword(undefined as unknown as string | null, undefined as unknown as string | null), "both undefined");
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 3: Combined validateBind
// ═══════════════════════════════════════════════════════════

console.log("\n── Combined validateBind ──");

test("valid credentials: matching password + matching IP", () => {
  const result = validateBind("1.2.3.4", "1.2.3.4", "secret", "secret");
  assertTrue(result.valid, "valid result");
  assertEqual(result.errorCode, 0, "errorCode is 0");
  assertEqual(result.errorMessage, "", "errorMessage is empty");
});

test("valid credentials: no IP restriction (null allowedIp)", () => {
  const result = validateBind(null, "10.0.0.1", "secret", "secret");
  assertTrue(result.valid, "no IP restriction, valid password");
});

test("valid credentials: no password set, no IP restriction", () => {
  const result = validateBind(null, "10.0.0.1", null, null);
  assertTrue(result.valid, "no restrictions at all");
});

test("IP mismatch: password correct but IP not in whitelist", () => {
  const result = validateBind("1.2.3.4", "5.6.7.8", "secret", "secret");
  assertFalse(result.valid, "IP mismatch fails");
  assertEqual(result.errorCode, SMPP_ESME_RBINDFAIL, "RBINDFAIL error code");
  assertTrue(result.errorMessage.includes("not in whitelist"), "error mentions whitelist");
});

test("IP mismatch: missing remote address with whitelist set", () => {
  const result = validateBind("1.2.3.4", undefined, "secret", "secret");
  assertFalse(result.valid, "missing remote fails");
  assertTrue(result.errorMessage.includes("not in whitelist"), "error mentions whitelist");
});

test("password mismatch takes precedence over IP check", () => {
  // IP would also fail, but password check runs first
  const result = validateBind("1.2.3.4", "5.6.7.8", "secret", "wrong");
  assertFalse(result.valid, "password mismatch fails");
  assertEqual(result.errorCode, SMPP_ESME_RBINDFAIL, "RBINDFAIL error code");
  assertEqual(result.errorMessage, "Password mismatch", "password error first");
});

test("password mismatch: null password with IP OK", () => {
  const result = validateBind("1.2.3.4", "1.2.3.4", "secret", null);
  assertFalse(result.valid, "null client password fails");
  assertEqual(result.errorMessage, "Password mismatch", "password error");
});

test("password mismatch: empty DB password, client sends something", () => {
  const result = validateBind(null, "10.0.0.1", null, "unexpected_password");
  assertFalse(result.valid, "unexpected password fails");
  assertEqual(result.errorMessage, "Password mismatch", "password error");
});

test("password mismatch: client sends empty, DB has password", () => {
  const result = validateBind(null, "10.0.0.1", "secret", null);
  assertFalse(result.valid, "empty client password vs DB password fails");
  assertEqual(result.errorMessage, "Password mismatch", "password error");
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 4: extractRemoteAddress
// ═══════════════════════════════════════════════════════════

console.log("\n── extractRemoteAddress ──");

test("extracts from socket.remoteAddress first", () => {
  const session = { socket: { remoteAddress: "1.2.3.4" }, remoteAddress: "5.6.7.8" };
  assertEqual(extractRemoteAddress(session), "1.2.3.4", "socket takes precedence");
});

test("falls back to remoteAddress when no socket", () => {
  const session = { remoteAddress: "5.6.7.8" };
  assertEqual(extractRemoteAddress(session), "5.6.7.8", "fallback to remoteAddress");
});

test("returns undefined when neither is present", () => {
  assertEqual(extractRemoteAddress({}), undefined, "empty object returns undefined");
  assertEqual(extractRemoteAddress({ socket: {} }), undefined, "empty socket returns undefined");
});

test("handles null socket gracefully", () => {
  const session = { socket: undefined as unknown as { remoteAddress?: string }, remoteAddress: "10.0.0.1" };
  assertEqual(extractRemoteAddress(session), "10.0.0.1", "null-ish socket falls back");
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 5: ESME & Supplier Authentication Scenarios
// ═══════════════════════════════════════════════════════════

console.log("\n── ESME & Supplier Scenarios ──");

test("ESME client: IP whitelist with multiple allowed IPs", () => {
  const result = validateBind(
    "192.168.1.100,10.0.0.50,172.16.0.1",
    "10.0.0.50",
    "esme_pass_2024",
    "esme_pass_2024"
  );
  assertTrue(result.valid, "ESME with whitelisted IP");
});

test("ESME client: rejected from unauthorized IP", () => {
  const result = validateBind(
    "192.168.1.100,10.0.0.50",
    "203.0.113.55",
    "esme_pass_2024",
    "esme_pass_2024"
  );
  assertFalse(result.valid, "ESME from unauthorized IP");
  assertTrue(result.errorMessage.includes("not in whitelist"), "IP whitelist error");
});

test("ESME client: IPv4-mapped address in whitelist", () => {
  const result = validateBind(
    "10.0.0.50",
    "::ffff:10.0.0.50",
    "pass123",
    "pass123"
  );
  assertTrue(result.valid, "IPv4-mapped matches IPv4 whitelist");
});

test("Supplier SERVER-mode: no IP whitelist, just password", () => {
  // Suppliers don't use IP whitelist (allowedIp=null)
  const result = validateBind(null, undefined, "supplier_key", "supplier_key");
  assertTrue(result.valid, "supplier with valid password and no IP restriction");
});

test("Supplier SERVER-mode: password mismatch rejected", () => {
  const result = validateBind(null, undefined, "supplier_key", "bad_password");
  assertFalse(result.valid, "supplier with bad password");
  assertEqual(result.errorMessage, "Password mismatch", "password error");
});

test("Supplier SERVER-mode: no password configured, empty password sent", () => {
  const result = validateBind(null, undefined, null, null);
  assertTrue(result.valid, "supplier with no password restriction");
});

test("ESME client: no IP restriction, valid password", () => {
  const result = validateBind("", "203.0.113.55", "client_secret", "client_secret");
  assertTrue(result.valid, "ESME with empty IP whitelist allows any IP");
});

// ═══════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════

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
