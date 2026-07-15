/**
 * Integration tests for the DLR Queue module.
 *
 * Covers:
 *  1. Queue on disconnect (enqueueDlr)
 *  2. Flush on reconnect — dequeueAllDlrs (used by both transceiver & receiver bind)
 *  3. Max size enforcement (MAX_DLR_QUEUE_PER_CLIENT)
 *  4. TTL cleanup (cleanupStaleDlrs)
 *  5. Re-queue after failed flush (requeueDlrs)
 *  6. Queue isolation between tenants/clients
 *
 * Run:  npx tsx src/lib/__tests__/dlr-queue.test.ts
 */
import assert from "node:assert/strict";
import {
  enqueueDlr,
  dequeueAllDlrs,
  requeueDlrs,
  getQueueDepth,
  peekQueue,
  getQueueKeys,
  getTotalQueued,
  cleanupStaleDlrs,
  clearAllQueues,
  MAX_DLR_QUEUE_PER_CLIENT,
  DLR_QUEUE_TTL_MS,
} from "../dlr-queue";
import type { DlrPayload } from "../smpp-client";

// ── Test helpers ──

function makeDlr(overrides: Partial<DlrPayload> = {}): DlrPayload {
  return {
    messageId: "msg_" + Math.random().toString(36).slice(2, 8),
    supplierMessageId: "sup_" + Math.random().toString(36).slice(2, 8),
    status: "DELIVRD",
    submitDate: String(Math.floor(Date.now() / 1000)),
    doneDate: String(Math.floor(Date.now() / 1000) + 1),
    errorCode: "000",
    dest: "254712345678",
    src: "TestSender",
    ...overrides,
  };
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  assert.deepStrictEqual(actual, expected, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertTrue(condition: boolean, label: string): void {
  assert.strictEqual(condition, true, `${label}: expected true, got false`);
}

// ── Run tests ──

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void): void {
  clearAllQueues();
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
// TEST SUITE 1: Queue on disconnect (enqueueDlr)
// ═══════════════════════════════════════════════════════════

console.log("\n── Queue on Disconnect ──");

test("enqueueDlr returns correct depth", () => {
  const r1 = enqueueDlr(1, 100, makeDlr());
  assertEqual(r1.depth, 1, "first DLR depth");
  assertEqual(r1.dropped, false, "first DLR should not be dropped");

  const r2 = enqueueDlr(1, 100, makeDlr());
  assertEqual(r2.depth, 2, "second DLR depth");
});

test("enqueueDlr for different clients are isolated", () => {
  enqueueDlr(1, 100, makeDlr());
  enqueueDlr(1, 200, makeDlr());
  enqueueDlr(1, 200, makeDlr());

  assertEqual(getQueueDepth(1, 100), 1, "client 100 depth");
  assertEqual(getQueueDepth(1, 200), 2, "client 200 depth");
});

test("enqueueDlr for different tenants are isolated", () => {
  enqueueDlr(1, 100, makeDlr());
  enqueueDlr(2, 100, makeDlr());
  enqueueDlr(2, 100, makeDlr());

  assertEqual(getQueueDepth(1, 100), 1, "tenant 1 client 100 depth");
  assertEqual(getQueueDepth(2, 100), 2, "tenant 2 client 100 depth");
});

test("getQueueDepth returns 0 for unknown client", () => {
  assertEqual(getQueueDepth(99, 999), 0, "unknown client depth");
});

test("peekQueue returns copy without removing", () => {
  const dlr = makeDlr();
  enqueueDlr(1, 100, dlr);

  const peeked = peekQueue(1, 100);
  assertEqual(peeked.length, 1, "peek length");
  assertEqual(peeked[0].messageId, dlr.messageId, "peek messageId matches");
  assertEqual(getQueueDepth(1, 100), 1, "depth unchanged after peek");
});

test("getTotalQueued aggregates across all queues", () => {
  enqueueDlr(1, 100, makeDlr());
  enqueueDlr(1, 100, makeDlr());
  enqueueDlr(1, 200, makeDlr());
  enqueueDlr(2, 100, makeDlr());

  assertEqual(getTotalQueued(), 4, "total queued");
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 2: Flush on reconnect (dequeueAllDlrs)
// ═══════════════════════════════════════════════════════════

console.log("\n── Flush on Reconnect ──");

test("dequeueAllDlrs returns all queued DLRs and clears queue", () => {
  const dlr1 = makeDlr();
  const dlr2 = makeDlr();
  enqueueDlr(1, 100, dlr1);
  enqueueDlr(1, 100, dlr2);

  const flushed = dequeueAllDlrs(1, 100);
  assertEqual(flushed.length, 2, "flushed count");
  assertEqual(flushed[0].messageId, dlr1.messageId, "first DLR messageId");
  assertEqual(flushed[1].messageId, dlr2.messageId, "second DLR messageId");
  assertEqual(getQueueDepth(1, 100), 0, "queue should be empty after flush");
});

test("dequeueAllDlrs returns empty array for unknown client", () => {
  const flushed = dequeueAllDlrs(99, 999);
  assertEqual(flushed.length, 0, "empty flush for unknown");
});

test("dequeueAllDlrs atomically claims queue — new DLRs after claim go to fresh queue", () => {
  enqueueDlr(1, 100, makeDlr());
  enqueueDlr(1, 100, makeDlr());

  const flushed = dequeueAllDlrs(1, 100);
  assertEqual(flushed.length, 2, "flushed original 2");

  // New DLR arriving after claim
  const dlr3 = makeDlr();
  enqueueDlr(1, 100, dlr3);

  // Should be in a new queue, not lost
  assertEqual(getQueueDepth(1, 100), 1, "new DLR in fresh queue");
  const flushed2 = dequeueAllDlrs(1, 100);
  assertEqual(flushed2.length, 1, "second flush");
  assertEqual(flushed2[0].messageId, dlr3.messageId, "new DLR preserved");
});

test("requeueDlrs puts DLRs back and merges with new arrivals", () => {
  const dlr1 = makeDlr();
  enqueueDlr(1, 100, dlr1);

  const flushed = dequeueAllDlrs(1, 100);
  assertEqual(flushed.length, 1, "flushed one");

  // New DLR arrives after claim
  const dlr2 = makeDlr();
  enqueueDlr(1, 100, dlr2);

  // Re-queue the ones that "failed to send"
  requeueDlrs(1, 100, [flushed[0]]);

  // Both should be in queue now (new arrivals first, then re-queued)
  assertEqual(getQueueDepth(1, 100), 2, "merged queue depth");
  const all = dequeueAllDlrs(1, 100);
  assertEqual(all[0].messageId, dlr2.messageId, "new DLR first");
  assertEqual(all[1].messageId, dlr1.messageId, "re-queued DLR second");
});

test("requeueDlrs with empty array is a no-op", () => {
  enqueueDlr(1, 100, makeDlr());
  requeueDlrs(1, 100, []);
  assertEqual(getQueueDepth(1, 100), 1, "depth unchanged");
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 3: Max Size Enforcement
// ═══════════════════════════════════════════════════════════

console.log("\n── Max Size Enforcement ──");

test("enqueueDlr does not drop when under max size", () => {
  for (let i = 0; i < MAX_DLR_QUEUE_PER_CLIENT - 1; i++) {
    const r = enqueueDlr(1, 100, makeDlr());
    assertTrue(!r.dropped, `DLR ${i} should not be dropped`);
  }
  assertEqual(getQueueDepth(1, 100), MAX_DLR_QUEUE_PER_CLIENT - 1, "just under max");
});

test("enqueueDlr at exactly max size does not drop", () => {
  for (let i = 0; i < MAX_DLR_QUEUE_PER_CLIENT; i++) {
    const r = enqueueDlr(1, 100, makeDlr({ messageId: `msg_${i}` }));
    if (i < MAX_DLR_QUEUE_PER_CLIENT - 1) {
      assertTrue(!r.dropped, `DLR ${i} should not be dropped`);
    }
  }
  assertEqual(getQueueDepth(1, 100), MAX_DLR_QUEUE_PER_CLIENT, "at exact max");
});

test("enqueueDlr drops oldest when exceeding max size", () => {
  // Fill queue to max
  const firstDlr = makeDlr({ messageId: "first_one" });
  enqueueDlr(1, 100, firstDlr);
  for (let i = 1; i < MAX_DLR_QUEUE_PER_CLIENT; i++) {
    enqueueDlr(1, 100, makeDlr({ messageId: `msg_${i}` }));
  }
  assertEqual(getQueueDepth(1, 100), MAX_DLR_QUEUE_PER_CLIENT, "at max before overflow");

  // Push one more — should drop the oldest (firstDlr)
  const newDlr = makeDlr({ messageId: "overflow_one" });
  const r = enqueueDlr(1, 100, newDlr);
  assertTrue(r.dropped, "should report dropped");
  assertEqual(r.depth, MAX_DLR_QUEUE_PER_CLIENT, "depth stays at max");

  // Verify the queue contents
  const all = dequeueAllDlrs(1, 100);
  assertEqual(all.length, MAX_DLR_QUEUE_PER_CLIENT, "still max after dequeue");
  assertEqual(all[0].messageId, "msg_1", "oldest remaining is msg_1 (first_one was dropped)");
  assertEqual(all[all.length - 1].messageId, "overflow_one", "newest is overflow_one");
});

test("getQueueKeys reflects active queues", () => {
  enqueueDlr(1, 100, makeDlr());
  enqueueDlr(1, 200, makeDlr());
  enqueueDlr(2, 100, makeDlr());

  const keys = getQueueKeys();
  assertTrue(keys.includes("1:100"), "has key 1:100");
  assertTrue(keys.includes("1:200"), "has key 1:200");
  assertTrue(keys.includes("2:100"), "has key 2:100");
  assertEqual(keys.length, 3, "three queue keys");
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 4: TTL Cleanup
// ═══════════════════════════════════════════════════════════

console.log("\n── TTL Cleanup ──");

test("cleanupStaleDlrs removes entries older than TTL", () => {
  const now = Math.floor(Date.now() / 1000);

  // Old DLR (submitted 20 minutes ago)
  const oldDlr = makeDlr({ submitDate: String(now - 1200) });
  enqueueDlr(1, 100, oldDlr);

  // Recent DLR (submitted 30 seconds ago)
  const recentDlr = makeDlr({ submitDate: String(now - 30) });
  enqueueDlr(1, 100, recentDlr);

  // Cleanup with 5-minute TTL (300000 ms)
  const cleaned = cleanupStaleDlrs(300_000);
  assertTrue(cleaned >= 1, "should have cleaned at least 1 entry");

  // Only the recent DLR should remain
  const remaining = dequeueAllDlrs(1, 100);
  assertEqual(remaining.length, 1, "only recent DLR remains");
  assertEqual(remaining[0].messageId, recentDlr.messageId, "recent DLR preserved");
});

test("cleanupStaleDlrs removes entire queue key when all entries stale", () => {
  const now = Math.floor(Date.now() / 1000);

  // All old
  enqueueDlr(1, 100, makeDlr({ submitDate: String(now - 3600) }));
  enqueueDlr(1, 100, makeDlr({ submitDate: String(now - 1800) }));

  const cleaned = cleanupStaleDlrs(300_000);
  assertTrue(cleaned >= 1, "should have cleaned");

  assertEqual(getQueueDepth(1, 100), 0, "queue empty");
  assertTrue(!getQueueKeys().includes("1:100"), "key removed from map");
});

test("cleanupStaleDlrs treats empty/unparseable submitDate as stale", () => {
  // Empty submitDate
  enqueueDlr(1, 100, makeDlr({ submitDate: "" }));
  // Also test undefined-ish (empty string is what we get from parseInt NaN)
  enqueueDlr(1, 100, makeDlr({ submitDate: "not_a_number" }));

  assertEqual(getQueueDepth(1, 100), 2, "both unparseable DLRs queued");

  const cleaned = cleanupStaleDlrs(300_000);
  assertTrue(cleaned >= 1, "should have cleaned the unparseable entry");

  // Both should be cleaned (treated as stale)
  const remaining = dequeueAllDlrs(1, 100);
  assertEqual(remaining.length, 0, "both unparseable DLRs removed");
});

test("cleanupStaleDlrs with default TTL uses DLR_QUEUE_TTL_MS", () => {
  const now = Math.floor(Date.now() / 1000);

  // Within default TTL (10 min = 600s)
  enqueueDlr(1, 100, makeDlr({ submitDate: String(now - 300) }));

  const cleaned = cleanupStaleDlrs(); // uses DLR_QUEUE_TTL_MS (600000)
  assertEqual(cleaned, 0, "no cleanup needed — DLR still fresh");

  const remaining = dequeueAllDlrs(1, 100);
  assertEqual(remaining.length, 1, "DLR preserved under default TTL");
});

test("cleanupStaleDlrs returns 0 when nothing to clean", () => {
  enqueueDlr(1, 100, makeDlr());
  const cleaned = cleanupStaleDlrs();
  assertEqual(cleaned, 0, "nothing cleaned");
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 5: End-to-End Scenario
// ═══════════════════════════════════════════════════════════

console.log("\n── End-to-End Scenario ──");

test("full lifecycle: queue → disconnect → reconnect → flush → success", () => {
  // Client A sends 3 messages, all get DLRs while disconnected
  const dlr1 = makeDlr({ messageId: "lifecycle_1" });
  const dlr2 = makeDlr({ messageId: "lifecycle_2" });
  const dlr3 = makeDlr({ messageId: "lifecycle_3" });

  assertEqual(getQueueDepth(1, 100), 0, "initial: empty");

  // Client disconnects, DLRs arrive (simulated by enqueueDlr)
  enqueueDlr(1, 100, dlr1);
  enqueueDlr(1, 100, dlr2);
  enqueueDlr(1, 100, dlr3);
  assertEqual(getQueueDepth(1, 100), 3, "3 DLRs queued");

  // Client reconnects as transceiver → smpp-server calls flushPendingDlrs
  // flushPendingDlrs calls dequeueAllDlrs
  const flushed = dequeueAllDlrs(1, 100);
  assertEqual(flushed.length, 3, "all 3 flushed");

  // Queue is now empty
  assertEqual(getQueueDepth(1, 100), 0, "queue empty after flush");

  // In a real scenario, each DLR is then sent via SMPP deliver_sm
  // If one fails, requeueDlrs is called with the unsent ones
  requeueDlrs(1, 100, [flushed[0]]);
  assertEqual(getQueueDepth(1, 100), 1, "failed DLR re-queued");

  // Client reconnects again → second flush
  const flushed2 = dequeueAllDlrs(1, 100);
  assertEqual(flushed2.length, 1, "re-queued DLR flushed on second reconnect");
  assertEqual(flushed2[0].messageId, dlr1.messageId, "correct DLR re-flushed");
});

test("clearAllQueues resets state completely", () => {
  enqueueDlr(1, 100, makeDlr());
  enqueueDlr(1, 200, makeDlr());
  enqueueDlr(2, 100, makeDlr());

  clearAllQueues();

  assertEqual(getTotalQueued(), 0, "total zero after clear");
  assertEqual(getQueueKeys().length, 0, "no queue keys");
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
