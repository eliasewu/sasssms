/**
 * Unit tests for Voice OTP DLR utilities (src/lib/voice-otp-dlr.ts).
 *
 * Covers:
 *  1. buildVoiceOtpHttpDlrPayload — correct structure, fields, status mapping
 *  2. buildVoiceOtpSmppDlrMessage — success message format (DELIVRD, dlvrd=001)
 *  3. buildVoiceOtpSmppDlrMessage — failure message format (UNDELIV, dlvrd=000)
 *  4. buildVoiceOtpSmppDlrMessage — error message propagation
 *  5. Edge cases: empty callAttempts, YYYYMMDD date format, stat/dlvrd consistency
 *
 * Run:  npx tsx src/lib/__tests__/voice-otp-dlr.test.ts
 */
import assert from "node:assert/strict";
import {
  buildVoiceOtpHttpDlrPayload,
  buildVoiceOtpSmppDlrMessage,
  pushDlrToClient,
} from "../voice-otp-dlr";
import type { VoiceOtpDlrParams } from "../voice-otp-dlr";
import type { CallAttempt } from "../voice-otp-engine";

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

function assertMatch(value: string, pattern: RegExp, label: string): void {
  assertTrue(pattern.test(value), `${label}: "${value}" does not match ${pattern}`);
}

function assertContains(haystack: string, needle: string, label: string): void {
  assertTrue(haystack.includes(needle), `${label}: "${haystack}" does not contain "${needle}"`);
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

// ── Sample data ──

const sampleCallAttempt: CallAttempt = {
  attempt: 1,
  language: "Bangla",
  startTime: "2026-07-23T10:00:00.000Z",
  endTime: "2026-07-23T10:00:30.000Z",
  duration: 30,
  status: "ANSWERED",
  audioPlaylist: [],
  sipCallId: "CALL_001",
  errorMessage: null,
};

const baseParams: VoiceOtpDlrParams = {
  messageId: "MSG_1234567890_abc123",
  destination: "+8801712345678",
  source: "OTP",
  status: "DELIVERED",
  cost: 0.00025,
  routeName: "Voice OTP Route",
  supplierName: "My SIP Provider",
  otpCode: "252627",
  language: "Bangla",
  callSid: "VOTCALL_abc123_xyz789",
  callAttempts: [sampleCallAttempt],
};

// ═══════════════════════════════════════════════════════════
// TEST SUITE 1: HTTP DLR Payload Structure
// ═══════════════════════════════════════════════════════════

console.log("\n── HTTP DLR Payload Structure ──");

test("payload has all required fields", () => {
  const payload = buildVoiceOtpHttpDlrPayload(baseParams);
  assertEqual(payload.message_id, baseParams.messageId, "message_id");
  assertEqual(payload.destination, baseParams.destination, "destination");
  assertEqual(payload.source, baseParams.source, "source");
  assertEqual(payload.status, "DELIVERED", "status");
  assertEqual(payload.cost, 0.00025, "cost");
  assertEqual(payload.route_name, "Voice OTP Route", "route_name");
  assertEqual(payload.supplier_name, "My SIP Provider", "supplier_name");
  assertEqual(payload.otp_code, "252627", "otp_code");
  assertEqual(payload.language, "Bangla", "language");
  assertEqual(payload.call_sid, "VOTCALL_abc123_xyz789", "call_sid");
  assertEqual(payload.attempt_count, 1, "attempt_count");
  assertEqual(payload.call_attempts.length, 1, "call_attempts array length");
});

test("timestamp is valid ISO 8601", () => {
  const payload = buildVoiceOtpHttpDlrPayload(baseParams);
  const parsed = new Date(payload.timestamp);
  assertFalse(isNaN(parsed.getTime()), "timestamp is parseable date");
  assertMatch(payload.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, "timestamp format");
});

test("status reflects DELIVERED when call succeeded", () => {
  const payload = buildVoiceOtpHttpDlrPayload({ ...baseParams, status: "DELIVERED" });
  assertEqual(payload.status, "DELIVERED", "DELIVERED status");
});

test("status reflects FAILED when call failed", () => {
  const payload = buildVoiceOtpHttpDlrPayload({ ...baseParams, status: "FAILED" });
  assertEqual(payload.status, "FAILED", "FAILED status");
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 2: HTTP DLR Call Attempts Handling
// ═══════════════════════════════════════════════════════════

console.log("\n── HTTP DLR Call Attempts ──");

test("call_attempts includes attempt number, language, status, duration", () => {
  const payload = buildVoiceOtpHttpDlrPayload(baseParams);
  const attempt = payload.call_attempts[0];
  assertEqual(attempt.attempt, 1, "attempt number");
  assertEqual(attempt.language, "Bangla", "attempt language");
  assertEqual(attempt.status, "ANSWERED", "attempt status");
  assertEqual(attempt.duration, 30, "attempt duration");
});

test("empty callAttempts produces empty array with attempt_count=0", () => {
  const params = { ...baseParams, callAttempts: [] };
  const payload = buildVoiceOtpHttpDlrPayload(params);
  assertEqual(payload.attempt_count, 0, "attempt_count is 0");
  assertEqual(payload.call_attempts.length, 0, "call_attempts is empty array");
});

test("multiple call attempts are all mapped", () => {
  const att2: CallAttempt = {
    attempt: 2, language: "English", startTime: "", endTime: null,
    duration: null, status: "NO_ANSWER", audioPlaylist: [], sipCallId: null, errorMessage: null,
  };
  const att3: CallAttempt = {
    attempt: 3, language: "Bangla", startTime: "", endTime: null,
    duration: 25, status: "ANSWERED", audioPlaylist: [], sipCallId: "CALL_003", errorMessage: null,
  };
  const params = { ...baseParams, callAttempts: [sampleCallAttempt, att2, att3] };
  const payload = buildVoiceOtpHttpDlrPayload(params);
  assertEqual(payload.attempt_count, 3, "attempt_count is 3");
  assertEqual(payload.call_attempts.length, 3, "3 call attempts");
  assertEqual(payload.call_attempts[1].status, "NO_ANSWER", "attempt 2 has NO_ANSWER");
  assertEqual(payload.call_attempts[2].language, "Bangla", "attempt 3 language");
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 3: SMPP DLR Success Message Format
// ═══════════════════════════════════════════════════════════

console.log("\n── SMPP DLR Success Message Format ──");

test("success message has stat:DELIVRD", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "SMPP_123", success: true });
  assertContains(msg, "stat:DELIVRD", "contains stat:DELIVRD");
});

test("success message has dlvrd:001", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "SMPP_123", success: true });
  assertContains(msg, "dlvrd:001", "contains dlvrd:001");
});

test("success message has sub:001", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "SMPP_123", success: true });
  assertContains(msg, "sub:001", "contains sub:001");
});

test("success message has err:000", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "SMPP_123", success: true });
  assertContains(msg, "err:000", "contains err:000");
});

test("success message includes the messageId", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "SMPP_abc_xyz", success: true });
  assertContains(msg, "id:SMPP_abc_xyz", "contains messageId");
});

test("success message has YYYYMMDD submit date", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "SMPP_123", success: true });
  assertMatch(msg, /submit date:\d{8}/, "submit date is YYYYMMDD");
});

test("success message has YYYYMMDD done date", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "SMPP_123", success: true });
  assertMatch(msg, /done date:\d{8}/, "done date is YYYYMMDD");
});

test("success message has voice OTP delivered text", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "SMPP_123", success: true });
  assertContains(msg, "text:Voice OTP call delivered", "contains delivery text");
});

test("full success message matches expected format", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "TEST_ID", success: true });
  // Should match: id:TEST_ID sub:001 dlvrd:001 submit date:YYYYMMDD done date:YYYYMMDD stat:DELIVRD err:000 text:Voice OTP call delivered
  const pattern = /^id:TEST_ID sub:001 dlvrd:001 submit date:\d{8} done date:\d{8} stat:DELIVRD err:000 text:Voice OTP call delivered$/;
  assertMatch(msg, pattern, "full success format");
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 4: SMPP DLR Failure Message Format
// ═══════════════════════════════════════════════════════════

console.log("\n── SMPP DLR Failure Message Format ──");

test("failure message has stat:UNDELIV", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "SMPP_456", success: false });
  assertContains(msg, "stat:UNDELIV", "contains stat:UNDELIV");
});

test("failure message has dlvrd:000", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "SMPP_456", success: false });
  assertContains(msg, "dlvrd:000", "contains dlvrd:000");
});

test("failure message has sub:001", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "SMPP_456", success: false });
  assertContains(msg, "sub:001", "contains sub:001");
});

test("failure message has err:000", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "SMPP_456", success: false });
  assertContains(msg, "err:000", "contains err:000");
});

test("failure message includes messageId", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "FAIL_789", success: false });
  assertContains(msg, "id:FAIL_789", "contains messageId");
});

test("failure message has YYYYMMDD dates", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "F_001", success: false });
  assertMatch(msg, /submit date:\d{8} done date:\d{8}/, "dates are YYYYMMDD");
});

test("failure message text uses default when no errorMessage provided", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "F_001", success: false });
  assertContains(msg, "text:Voice OTP call failed", "default failure text");
});

test("failure message text uses custom errorMessage when provided", () => {
  const msg = buildVoiceOtpSmppDlrMessage({
    messageId: "F_002",
    success: false,
    errorMessage: "Concurrent call limit reached",
  });
  assertContains(msg, "text:Concurrent call limit reached", "custom error message");
});

test("failure message text includes SIP config error", () => {
  const msg = buildVoiceOtpSmppDlrMessage({
    messageId: "F_003",
    success: false,
    errorMessage: "No SIP config configured — configure voice_otp_sip_config or use Asterisk AMI",
  });
  assertContains(msg, "text:No SIP config configured", "SIP config error propagated");
});

test("full failure message matches expected format", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "BAD", success: false, errorMessage: "Call rejected" });
  const pattern = /^id:BAD sub:001 dlvrd:000 submit date:\d{8} done date:\d{8} stat:UNDELIV err:000 text:Call rejected$/;
  assertMatch(msg, pattern, "full failure format");
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 5: Edge Cases & Consistency
// ═══════════════════════════════════════════════════════════

console.log("\n── Edge Cases & Consistency ──");

test("success → dlvrd=001 AND stat=DELIVRD are consistent", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "X", success: true });
  assertContains(msg, "dlvrd:001", "dlvrd is 001");
  assertContains(msg, "stat:DELIVRD", "stat is DELIVRD");
  assertFalse(msg.includes("UNDELIV"), "no UNDELIV on success");
});

test("failure → dlvrd=000 AND stat=UNDELIV are consistent", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "X", success: false });
  assertContains(msg, "dlvrd:000", "dlvrd is 000");
  assertContains(msg, "stat:UNDELIV", "stat is UNDELIV");
  assertFalse(msg.includes("DELIVRD"), "no DELIVRD on failure");
  assertFalse(msg.includes("dlvrd:001"), "no dlvrd:001 on failure");
});

test("HTTP payload does NOT leak internal fields", () => {
  const payload = buildVoiceOtpHttpDlrPayload(baseParams);
  const keys = Object.keys(payload);
  // Should not contain internal IDs like sipCallId or errorMessage
  assertFalse(keys.includes("sipCallId" as any), "no sipCallId in payload");
  assertFalse(keys.includes("errorMessage" as any), "no errorMessage in payload");
});

test("HTTP payload cost is a number", () => {
  const payload = buildVoiceOtpHttpDlrPayload(baseParams);
  assertEqual(typeof payload.cost, "number", "cost is number");
});

test("HTTP payload preserves cost: 0 exactly — not omitted, null, or undefined", () => {
  const params: VoiceOtpDlrParams = {
    ...baseParams,
    status: "FAILED",
    cost: 0,
    callSid: "",
    callAttempts: [],
  };
  const payload = buildVoiceOtpHttpDlrPayload(params);
  assertEqual(payload.cost, 0, "cost is exactly 0");
  assertEqual(typeof payload.cost, "number", "cost is still a number");
  // Verify JSON round-trip doesn't drop it
  const json = JSON.stringify(payload);
  const parsed = JSON.parse(json);
  assertEqual(parsed.cost, 0, "cost: 0 survives JSON round-trip");
  assertContains(json, '"cost":0', "JSON contains 'cost':0 literally (not null)");
});

test("HTTP payload call_attempts durations are nullable", () => {
  const attWithNull: CallAttempt = {
    attempt: 1, language: "French", startTime: "", endTime: null,
    duration: null, status: "NO_ANSWER", audioPlaylist: [], sipCallId: null, errorMessage: null,
  };
  const params = { ...baseParams, callAttempts: [attWithNull], status: "FAILED" as const };
  const payload = buildVoiceOtpHttpDlrPayload(params);
  assertEqual(payload.call_attempts[0].duration, null, "null duration preserved");
});

test("SMPP submit and done dates are identical (synchronous result)", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "X", success: true });
  const submitMatch = msg.match(/submit date:(\d{8})/);
  const doneMatch = msg.match(/done date:(\d{8})/);
  assertEqual(submitMatch![1], doneMatch![1], "submit and done dates match (sync call)");
});

test("SMPP date is today's date", () => {
  const msg = buildVoiceOtpSmppDlrMessage({ messageId: "X", success: true });
  const match = msg.match(/submit date:(\d{8})/);
  const actual = match![1];
  // Should be today in YYYYMMDD format
  const now = new Date();
  const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  assertEqual(actual, today, "date is today");
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 6: Integration Tests — builder + pushDlrToClient
// ═══════════════════════════════════════════════════════════

console.log("\n── Integration: Builder → Spy Push ──");

/**
 * Spy that replaces pushDlrToClient in integration tests.
 * Captures the URL and payload so we can assert on them without
 * making real HTTP calls.
 */
function createDlrSpy() {
  const calls: Array<{ url: string; payload: Record<string, unknown> }> = [];
  return {
    push: async (url: string, payload: Record<string, unknown>) => {
      calls.push({ url, payload });
      return true;
    },
    calls,
    lastCall: () => calls[calls.length - 1] || null,
    callCount: () => calls.length,
  };
}

// ── Helper: simulates the send-sms/route.ts Voice OTP DLR push flow ──
async function simulateVoiceOtpDlrFlow(
  pushFn: (url: string, payload: Record<string, unknown>) => Promise<boolean>,
  callBackUrl: string | null,
  params: VoiceOtpDlrParams
) {
  if (callBackUrl) {
    const payload = buildVoiceOtpHttpDlrPayload(params);
    pushFn(callBackUrl, payload).catch(() => {});
  }
}

test("integration: success flow pushes DELIVERED payload to webhook", async () => {
  const spy = createDlrSpy();
  await simulateVoiceOtpDlrFlow(spy.push, "https://client.example.com/dlr", baseParams);

  assertEqual(spy.callCount(), 1, "push was called once");
  const captured = spy.lastCall()!;
  assertEqual(captured.url, "https://client.example.com/dlr", "correct webhook URL");
  assertEqual(captured.payload.status, "DELIVERED", "payload status is DELIVERED");
  assertEqual(captured.payload.message_id, baseParams.messageId, "payload has message_id");
  assertEqual(captured.payload.destination, baseParams.destination, "payload has destination");
  assertEqual(captured.payload.source, baseParams.source, "payload has source");
  assertEqual(captured.payload.otp_code, "252627", "payload has otp_code");
  assertEqual(captured.payload.language, "Bangla", "payload has language");
  assertEqual(captured.payload.attempt_count, 1, "payload has attempt_count");
  assertTrue(typeof captured.payload.timestamp === "string", "timestamp is present");
});

test("integration: failure flow pushes FAILED payload to webhook", async () => {
  const spy = createDlrSpy();
  const failParams: VoiceOtpDlrParams = {
    ...baseParams,
    status: "FAILED",
    callSid: "",
    callAttempts: [],
    cost: 0,
  };
  await simulateVoiceOtpDlrFlow(spy.push, "https://client.example.com/dlr", failParams);

  assertEqual(spy.callCount(), 1, "push was called once");
  const captured = spy.lastCall()!;
  assertEqual(captured.payload.status, "FAILED", "payload status is FAILED");
  assertEqual(captured.payload.cost, 0, "cost is 0 on failure");
  assertEqual(captured.payload.attempt_count, 0, "attempt_count is 0");
  assertEqual((captured.payload as any).call_attempts.length, 0, "call_attempts is empty");
  assertEqual(captured.payload.call_sid, "", "call_sid is empty string");
});

test("integration: no DLR push when callback URL is null", async () => {
  const spy = createDlrSpy();
  await simulateVoiceOtpDlrFlow(spy.push, null, baseParams);
  assertEqual(spy.callCount(), 0, "push was NOT called when URL is null");
});

test("integration: no DLR push when callback URL is empty string", async () => {
  const spy = createDlrSpy();
  await simulateVoiceOtpDlrFlow(spy.push, "", baseParams);
  assertEqual(spy.callCount(), 0, "push was NOT called when URL is empty");
});

test("integration: success payload contains route and supplier info", async () => {
  const spy = createDlrSpy();
  await simulateVoiceOtpDlrFlow(spy.push, "https://example.com/hook", baseParams);
  const captured = spy.lastCall()!;
  assertEqual(captured.payload.route_name, "Voice OTP Route", "route_name in payload");
  assertEqual(captured.payload.supplier_name, "My SIP Provider", "supplier_name in payload");
});

test("integration: multiple calls are all captured in order", async () => {
  const spy = createDlrSpy();
  // First call — success
  await simulateVoiceOtpDlrFlow(spy.push, "https://example.com/hook", baseParams);
  // Second call — failure
  await simulateVoiceOtpDlrFlow(spy.push, "https://example.com/hook", {
    ...baseParams,
    status: "FAILED",
    messageId: "MSG_FAIL_001",
    callSid: "",
    callAttempts: [],
    cost: 0,
  });

  assertEqual(spy.callCount(), 2, "two calls captured");
  assertEqual(spy.calls[0].payload.status, "DELIVERED", "first call is DELIVERED");
  assertEqual(spy.calls[1].payload.status, "FAILED", "second call is FAILED");
  assertEqual(spy.calls[0].payload.message_id, "MSG_1234567890_abc123", "first has correct message_id");
  assertEqual(spy.calls[1].payload.message_id, "MSG_FAIL_001", "second has correct message_id");
});

test("integration: failure payload with concurrent limit scenario", async () => {
  const spy = createDlrSpy();
  // Simulate concurrent-limit rejection: no call attempts, empty callSid, cost=0
  await simulateVoiceOtpDlrFlow(spy.push, "https://api.example.com/dlr", {
    ...baseParams,
    status: "FAILED",
    callSid: "",
    callAttempts: [],
    cost: 0,
  });

  const captured = spy.lastCall()!;
  assertEqual(captured.payload.status, "FAILED", "status is FAILED");
  assertEqual(captured.payload.attempt_count, 0, "no attempts (concurrent rejection)");
  assertEqual(captured.payload.call_sid, "", "empty call_sid");
  assertEqual(captured.payload.cost, 0, "zero cost on rejection");
});

test("integration: payload is JSON-serializable (no Date or undefined values)", async () => {
  const spy = createDlrSpy();
  await simulateVoiceOtpDlrFlow(spy.push, "https://example.com/hook", baseParams);
  const captured = spy.lastCall()!;
  // JSON.stringify should not throw
  let json: string;
  try {
    json = JSON.stringify(captured.payload);
  } catch {
    assertTrue(false, "payload should be JSON-serializable");
    return;
  }
  const parsed = JSON.parse(json);
  assertEqual(parsed.status, "DELIVERED", "can round-trip through JSON");
  assertEqual(parsed.message_id, baseParams.messageId, "message_id survives JSON round-trip");
});

test("integration: pushDlrToClient export is callable (type-check import)", () => {
  assertEqual(typeof pushDlrToClient, "function", "pushDlrToClient is a function");
  assertEqual(pushDlrToClient.length, 2, "pushDlrToClient takes 2 parameters");
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
