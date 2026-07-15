/**
 * Integration tests for the DLR Queue Persistence module.
 *
 * Tests REAL database operations against a live PostgreSQL instance.
 * Uses the first active tenant schema as a sandbox — cleans up before/after.
 *
 * Covers:
 *  1. enqueueDlrPersist → DB row inserted, fields correct, max-size enforcement
 *  2. dequeueAllDlrsPersist → DB row deleted by message ID
 *  3. requeueDlrsPersist → DB rows re-inserted
 *  4. loadDlrsFromDbForTenant → DB rows hydrating memory
 *  5. loadAllDlrsFromDb → all tenants loaded
 *  6. cleanupStaleDlrsPersist → stale rows removed from DB + memory
 *  7. Memory/DB consistency through full lifecycle
 *
 * Run:  npx tsx src/lib/__tests__/dlr-queue-persist.test.ts
 *
 * Prerequisites: PostgreSQL running, .env with DATABASE_URL, at least 1 active tenant
 */
import assert from "node:assert/strict";
import { pool } from "@/db";
import * as memQueue from "@/lib/dlr-queue";
import {
  enqueueDlrPersist,
  dequeueAllDlrsPersist,
  requeueDlrsPersist,
  loadDlrsFromDbForTenant,
  loadAllDlrsFromDb,
  cleanupStaleDlrsPersist,
  startDlrCleanupPersist,
} from "@/lib/dlr-queue-persist";
import type { DlrPayload } from "@/lib/smpp-client";

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

async function clearDb(): Promise<void> {
  const { schemaName } = await getTestContext();
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    await client.query("DELETE FROM pending_dlrs");
  } finally {
    await client.query("SET search_path TO public");
    client.release();
  }
}

function setup() {
  memQueue.clearAllQueues();
  return Promise.resolve();
}

/**
 * Wait for DB to reach an expected row count for a client.
 * Retries up to 30 times (1.5s total) — deterministic, not fixed-delay.
 */
async function awaitDbCount(clientId: number, expectedCount: number, maxRetries = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    const count = await countDbRows(clientId);
    if (count === expectedCount) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  const actual = await countDbRows(clientId);
  throw new Error(`DB never reached ${expectedCount} rows for client ${clientId} (got ${actual})`);
}

/**
 * Count total rows in pending_dlrs across all clients.
 */
async function totalDbRows(): Promise<number> {
  const { schemaName } = await getTestContext();
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    const { rows } = await client.query("SELECT COUNT(*)::int as cnt FROM pending_dlrs");
    return rows[0].cnt;
  } finally {
    await client.query("SET search_path TO public");
    client.release();
  }
}

/**
 * Drain any pending fire-and-forget DB writes before clearing.
 * Polls total row count until stable (3 consecutive reads with no change).
 * Logs a warning if drain times out.
 */
async function drainAllDbWrites(maxRetries = 40): Promise<void> {
  let lastCount = -1;
  let stable = 0;
  for (let i = 0; i < maxRetries; i++) {
    const count = await totalDbRows();
    if (count === lastCount) {
      stable++;
      if (stable >= 3) return; // 3 consecutive stable reads = drained
    } else {
      stable = 0;
      lastCount = count;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  console.warn(`  [TEST] Drain timed out at ${lastCount} total rows — some writes may still be in-flight`);
}

function makeDlr(overrides: Partial<DlrPayload> = {}): DlrPayload {
  return {
    messageId: "persist_" + Math.random().toString(36).slice(2, 8),
    supplierMessageId: "sup_" + Math.random().toString(36).slice(2, 6),
    status: "DELIVRD",
    submitDate: String(Math.floor(Date.now() / 1000)),
    doneDate: String(Math.floor(Date.now() / 1000) + 1),
    errorCode: "000",
    dest: "254712345678",
    src: "TestSender",
    ...overrides,
  };
}

async function countDbRows(clientId: number): Promise<number> {
  const { schemaName } = await getTestContext();
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    const { rows } = await client.query(
      "SELECT COUNT(*)::int as cnt FROM pending_dlrs WHERE client_id = $1",
      [clientId]
    );
    return rows[0].cnt;
  } finally {
    await client.query("SET search_path TO public");
    client.release();
  }
}

// ── Test runner ──

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  await setup();
  // Drain any pending fire-and-forget writes from previous tests before clearing
  await drainAllDbWrites();
  await clearDb();
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
// TEST SUITE 1: enqueueDlrPersist — DB persistence
// ═══════════════════════════════════════════════════════════

async function suiteEnqueue() {
  console.log("\n── DB Persist on Enqueue ──");

  await test("enqueueDlrPersist writes to in-memory queue", async () => {
    const { tenantId } = await getTestContext();
    const dlr = makeDlr();
    const result = enqueueDlrPersist(tenantId, 100, ctx!.schemaName, dlr);
    assert.equal(result.depth, 1, "depth should be 1");
    assert.equal(result.dropped, false, "should not be dropped");
    assert.equal(memQueue.getQueueDepth(tenantId, 100), 1, "memory queue has entry");
  });

  await test("enqueueDlrPersist inserts row into pending_dlrs table", async () => {
    const { tenantId } = await getTestContext();
    const dlr = makeDlr({ messageId: "test-db-insert-1" });
    enqueueDlrPersist(tenantId, 100, ctx!.schemaName, dlr);
    await awaitDbCount(100, 1);
  });

  await test("enqueueDlrPersist stores all DLR fields correctly in DB", async () => {
    const { schemaName } = await getTestContext();
    const dlr = makeDlr({
      messageId: "full-fields-test",
      supplierMessageId: "supplier-abc-123",
      status: "DELIVRD",
      submitDate: "1700000000",
      doneDate: "1700000001",
      errorCode: "000",
      dest: "254700111222",
      src: "MyApp",
    });
    enqueueDlrPersist(ctx!.tenantId, 200, schemaName, dlr);
    await awaitDbCount(200, 1);

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      const { rows } = await client.query(
        "SELECT * FROM pending_dlrs WHERE message_id = $1",
        ["full-fields-test"]
      );
      assert.equal(rows.length, 1, "row should exist");
      const row = rows[0];
      assert.equal(row.message_id, "full-fields-test");
      assert.equal(row.supplier_message_id, "supplier-abc-123");
      assert.equal(row.status, "DELIVRD");
      assert.equal(row.submit_date, "1700000000");
      assert.equal(row.done_date, "1700000001");
      assert.equal(row.error_code, "000");
      assert.equal(row.dest, "254700111222");
      assert.equal(row.src, "MyApp");
    } finally {
      await client.query("SET search_path TO public");
      client.release();
    }
  });

  await test("multiple enqueueDlrPersist creates multiple DB rows", async () => {
    const { tenantId } = await getTestContext();
    for (let i = 0; i < 5; i++) {
      enqueueDlrPersist(tenantId, 300, ctx!.schemaName, makeDlr({ messageId: `multi-${i}` }));
    }
    await awaitDbCount(300, 5);
  });

  await test("enqueueDlrPersist DB write failure does not affect memory", async () => {
    // Use an invalid schema to trigger DB failure, memory should still work
    const { tenantId } = await getTestContext();
    const dlr = makeDlr({ messageId: "memory-survives-db-fail" });
    const result = enqueueDlrPersist(tenantId, 400, "nonexistent_schema", dlr);
    // Memory should be fine even though DB will fail async
    assert.equal(result.depth, 1);
    assert.equal(memQueue.getQueueDepth(tenantId, 400), 1);
    // Memory still intact
    assert.equal(memQueue.getQueueDepth(tenantId, 400), 1);
  });

  await test("enqueueDlrPersist drops oldest and reports dropped=true when exceeding max size", async () => {
    const { tenantId } = await getTestContext();
    const maxSize = memQueue.MAX_DLR_QUEUE_PER_CLIENT;

    // Fill queue to exactly max
    for (let i = 0; i < maxSize; i++) {
      enqueueDlrPersist(tenantId, 450, ctx!.schemaName, makeDlr({ messageId: `drop-test-${i}` }));
    }
    assert.equal(memQueue.getQueueDepth(tenantId, 450), maxSize, "at max");

    // Push one more — should drop oldest and persist to DB correctly
    const overflow = makeDlr({ messageId: "overflow-dlr" });
    const result = enqueueDlrPersist(tenantId, 450, ctx!.schemaName, overflow);
    assert.equal(result.dropped, true, "should report dropped");
    assert.equal(result.depth, maxSize, "depth stays at max");
    assert.equal(memQueue.getQueueDepth(tenantId, 450), maxSize, "in-memory at max");

    // Verify DB only has maxSize rows (oldest was deleted by persistToDb)
    await awaitDbCount(450, maxSize);

    // Verify the newest and oldest in memory
    const flushed = memQueue.dequeueAllDlrs(tenantId, 450);
    assert.equal(flushed.length, maxSize);
    assert.equal(flushed[0].messageId, "drop-test-1", "oldest is msg_1 (msg_0 was dropped)");
    assert.equal(flushed[flushed.length - 1].messageId, "overflow-dlr", "newest is overflow");
  });
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE 2: dequeueAllDlrsPersist — DB row deletion
// ═══════════════════════════════════════════════════════════

async function suiteDequeue() {
  console.log("\n── DB Delete on Dequeue ──");

  await test("dequeueAllDlrsPersist removes from memory and DB", async () => {
    const { tenantId } = await getTestContext();
    const dlr1 = makeDlr({ messageId: "dequeue-test-1" });
    const dlr2 = makeDlr({ messageId: "dequeue-test-2" });

    enqueueDlrPersist(tenantId, 500, ctx!.schemaName, dlr1);
    enqueueDlrPersist(tenantId, 500, ctx!.schemaName, dlr2);
    await awaitDbCount(500, 2);

    const flushed = dequeueAllDlrsPersist(tenantId, 500, ctx!.schemaName);
    assert.equal(flushed.length, 2, "both DLRs dequeued");
    assert.equal(flushed[0].messageId, dlr1.messageId);
    assert.equal(flushed[1].messageId, dlr2.messageId);
    assert.equal(memQueue.getQueueDepth(tenantId, 500), 0, "memory cleared");

    await awaitDbCount(500, 0);
  });

  await test("dequeueAllDlrsPersist only deletes matching message IDs", async () => {
    const { tenantId } = await getTestContext();
    const dlr1 = makeDlr({ messageId: "keep-me" });
    const dlr2 = makeDlr({ messageId: "remove-me" });

    // Use different clients so we can test targeted deletion
    enqueueDlrPersist(tenantId, 501, ctx!.schemaName, dlr1);
    enqueueDlrPersist(tenantId, 502, ctx!.schemaName, dlr2);
    await awaitDbCount(501, 1);

    // Dequeue client 502 only
    const flushed = dequeueAllDlrsPersist(tenantId, 502, ctx!.schemaName);
    assert.equal(flushed.length, 1);
    assert.equal(flushed[0].messageId, "remove-me");

    // client 501 should still have its row, client 502 should be deleted
    const count501 = await countDbRows(501);
    assert.equal(count501, 1, "client 501 row preserved");
    await awaitDbCount(502, 0);
  });

  await test("dequeueAllDlrsPersist returns empty for unknown client", async () => {
    const { tenantId } = await getTestContext();
    const flushed = dequeueAllDlrsPersist(tenantId, 99999, ctx!.schemaName);
    assert.equal(flushed.length, 0);
  });
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE 3: requeueDlrsPersist — re-insert after failure
// ═══════════════════════════════════════════════════════════

async function suiteRequeue() {
  console.log("\n── DB Persist on Requeue ──");

  await test("requeueDlrsPersist re-inserts DLRs into DB", async () => {
    const { tenantId } = await getTestContext();
    const dlr1 = makeDlr({ messageId: "requeue-1" });
    const dlr2 = makeDlr({ messageId: "requeue-2" });

    // Dequeue first (simulating flush), then re-queue (simulating send failure)
    enqueueDlrPersist(tenantId, 600, ctx!.schemaName, dlr1);
    enqueueDlrPersist(tenantId, 600, ctx!.schemaName, dlr2);
    await awaitDbCount(600, 2);

    const flushed = dequeueAllDlrsPersist(tenantId, 600, ctx!.schemaName);
    await awaitDbCount(600, 0);

    // Simulate: send failed for dlr1, re-queue it
    requeueDlrsPersist(tenantId, 600, ctx!.schemaName, [flushed[0]]);
    assert.equal(memQueue.getQueueDepth(tenantId, 600), 1, "one re-queued in memory");

    await awaitDbCount(600, 1);
  });

  await test("requeueDlrsPersist with empty array is no-op", async () => {
    const { tenantId } = await getTestContext();
    const before = await countDbRows(700);
    requeueDlrsPersist(tenantId, 700, ctx!.schemaName, []);
    // No rows should be added (empty array is no-op)
    const after = await countDbRows(700);
    assert.equal(after, before, "no change");
  });
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE 4: loadDlrsFromDbForTenant — hydration from DB
// ═══════════════════════════════════════════════════════════

async function suiteLoadFromDb() {
  console.log("\n── Load DLRs from DB (Hydration) ──");

  await test("loadDlrsFromDbForTenant loads DB rows into memory", async () => {
    const { schemaName, tenantId } = await getTestContext();

    // Insert rows directly into DB (bypassing memory)
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      await client.query(
        `INSERT INTO pending_dlrs (client_id, message_id, supplier_message_id, status, submit_date, done_date, error_code, dest, src)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [800, "hydrate-1", "sup-1", "DELIVRD", "1700000000", "1700000001", "000", "254700111222", "HydrateApp"]
      );
      await client.query(
        `INSERT INTO pending_dlrs (client_id, message_id, supplier_message_id, status, submit_date, done_date, error_code, dest, src)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [800, "hydrate-2", "sup-2", "UNDELIV", "1700000100", "1700000101", "005", "254700333444", "HydrateApp"]
      );
    } finally {
      await client.query("SET search_path TO public");
      client.release();
    }

    // Memory should be empty before load
    assert.equal(memQueue.getQueueDepth(tenantId, 800), 0, "memory empty before load");

    // Load from DB
    const loaded = await loadDlrsFromDbForTenant(schemaName, tenantId);
    assert.equal(loaded, 2, "loaded 2 DLRs");
    assert.equal(memQueue.getQueueDepth(tenantId, 800), 2, "memory hydrated");

    // Verify loaded DLRs have correct data
    const flushed = memQueue.dequeueAllDlrs(tenantId, 800);
    assert.equal(flushed.length, 2);
    assert.equal(flushed[0].messageId, "hydrate-1");
    assert.equal(flushed[0].status, "DELIVRD");
    assert.equal(flushed[1].messageId, "hydrate-2");
    assert.equal(flushed[1].status, "UNDELIV");
  });

  await test("loadDlrsFromDbForTenant returns 0 for empty DB", async () => {
    const { schemaName, tenantId } = await getTestContext();
    const loaded = await loadDlrsFromDbForTenant(schemaName, tenantId);
    assert.equal(loaded, 0, "no rows to load");
  });

  await test("loadAllDlrsFromDb loads from all active tenants", async () => {
    // Insert rows for this tenant
    const { schemaName } = await getTestContext();
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      await client.query(
        `INSERT INTO pending_dlrs (client_id, message_id, supplier_message_id, status, submit_date, done_date, error_code, dest, src)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [900, "loadall-1", "sup-loadall", "DELIVRD", "1700000000", "1700000001", "000", "254700111222", "LoadAll"]
      );
    } finally {
      await client.query("SET search_path TO public");
      client.release();
    }

    const total = await loadAllDlrsFromDb();
    assert.ok(total >= 1, `should load at least 1 DLR, got ${total}`);
    // Verify the specific test tenant's row was loaded into memory
    assert.equal(memQueue.getQueueDepth(ctx!.tenantId, 900), 1, "test tenant's DLR loaded into memory");
  });

  await test("loadDlrsFromDbForTenant preserves DLR ordering by created_at", async () => {
    const { schemaName, tenantId } = await getTestContext();
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      await client.query(
        `INSERT INTO pending_dlrs (client_id, message_id, status, dest, src, created_at)
         VALUES ($1, 'order-1', 'DELIVRD', '254700111222', 'A', NOW() - INTERVAL '5 seconds')`,
        [801]
      );
      await client.query(
        `INSERT INTO pending_dlrs (client_id, message_id, status, dest, src, created_at)
         VALUES ($1, 'order-2', 'DELIVRD', '254700111222', 'A', NOW() - INTERVAL '3 seconds')`,
        [801]
      );
      await client.query(
        `INSERT INTO pending_dlrs (client_id, message_id, status, dest, src, created_at)
         VALUES ($1, 'order-3', 'DELIVRD', '254700111222', 'A', NOW() - INTERVAL '1 second')`,
        [801]
      );
    } finally {
      await client.query("SET search_path TO public");
      client.release();
    }

    await loadDlrsFromDbForTenant(schemaName, tenantId);
    const flushed = memQueue.dequeueAllDlrs(tenantId, 801);
    assert.equal(flushed.length, 3);
    assert.equal(flushed[0].messageId, "order-1", "oldest first");
    assert.equal(flushed[1].messageId, "order-2");
    assert.equal(flushed[2].messageId, "order-3", "newest last");
  });
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE 5: cleanupStaleDlrsPersist — DB + memory cleanup
// ═══════════════════════════════════════════════════════════

async function suiteCleanup() {
  console.log("\n── Stale DLR Cleanup (DB + Memory) ──");

  await test("cleanupStaleDlrsPersist removes old rows from DB", async () => {
    const { schemaName } = await getTestContext();
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schemaName}"`);
      // Insert an old row (created 20 minutes ago)
      await client.query(
        `INSERT INTO pending_dlrs (client_id, message_id, status, dest, src, created_at)
         VALUES ($1, 'stale-1', 'DELIVRD', '254700111222', 'A', NOW() - INTERVAL '20 minutes')`,
        [1001]
      );
      // Insert a fresh row
      await client.query(
        `INSERT INTO pending_dlrs (client_id, message_id, status, dest, src, created_at)
         VALUES ($1, 'fresh-1', 'DELIVRD', '254700111222', 'A', NOW())`,
        [1001]
      );
    } finally {
      await client.query("SET search_path TO public");
      client.release();
    }

    // Cleanup with 5-minute TTL
    const cleaned = await cleanupStaleDlrsPersist(300_000);
    assert.ok(cleaned >= 1, `should clean at least 1 entry, got ${cleaned}`);

    // Verify only fresh row remains
    const client2 = await pool.connect();
    try {
      await client2.query(`SET search_path TO "${schemaName}"`);
      const { rows } = await client2.query(
        "SELECT message_id FROM pending_dlrs WHERE client_id = $1 ORDER BY message_id",
        [1001]
      );
      assert.equal(rows.length, 1, "only 1 row should remain");
      assert.equal(rows[0].message_id, "fresh-1", "fresh row preserved");
    } finally {
      await client2.query("SET search_path TO public");
      client2.release();
    }
  });

  await test("cleanupStaleDlrsPersist also cleans in-memory queue", async () => {
    const { tenantId } = await getTestContext();

    // Enqueue to memory only (old date)
    const oldDlr = makeDlr({
      messageId: "mem-stale",
      submitDate: String(Math.floor(Date.now() / 1000) - 3600), // 1 hour ago
    });
    memQueue.enqueueDlr(tenantId, 1002, oldDlr);

    // Enqueue to memory (fresh)
    const freshDlr = makeDlr({
      messageId: "mem-fresh",
      submitDate: String(Math.floor(Date.now() / 1000)),
    });
    memQueue.enqueueDlr(tenantId, 1002, freshDlr);

    const cleaned = await cleanupStaleDlrsPersist(300_000);
    assert.ok(cleaned >= 1, "should clean memory entries");

    const remaining = memQueue.dequeueAllDlrs(tenantId, 1002);
    assert.equal(remaining.length, 1, "only fresh DLR remains");
    assert.equal(remaining[0].messageId, "mem-fresh");
  });

  await test("cleanupStaleDlrsPersist returns 0 when nothing to clean", async () => {
    const { tenantId } = await getTestContext();
    const dlr = makeDlr(); // fresh
    memQueue.enqueueDlr(tenantId, 1003, dlr);
    const cleaned = await cleanupStaleDlrsPersist(600_000);
    assert.equal(cleaned, 0, "nothing should be stale with 10-min TTL");
  });
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE 6: Full lifecycle — memory + DB consistency
// ═══════════════════════════════════════════════════════════

async function suiteLifecycle() {
  console.log("\n── Full Lifecycle: Memory + DB Consistency ──");

  await test("lifecycle: enqueue → restart simulation → hydrate → dequeue", async () => {
    const { schemaName, tenantId } = await getTestContext();

    // Phase 1: Enqueue 3 DLRs (memory + DB)
    const dlr1 = makeDlr({ messageId: "lifecycle-p1" });
    const dlr2 = makeDlr({ messageId: "lifecycle-p2" });
    const dlr3 = makeDlr({ messageId: "lifecycle-p3" });

    enqueueDlrPersist(tenantId, 1100, schemaName, dlr1);
    enqueueDlrPersist(tenantId, 1100, schemaName, dlr2);
    enqueueDlrPersist(tenantId, 1100, schemaName, dlr3);
    await awaitDbCount(1100, 3);
    assert.equal(memQueue.getQueueDepth(tenantId, 1100), 3, "3 in memory");

    // Phase 2: Simulate restart — clear memory, reload from DB
    memQueue.clearAllQueues();
    assert.equal(memQueue.getQueueDepth(tenantId, 1100), 0, "memory cleared");

    await loadDlrsFromDbForTenant(schemaName, tenantId);
    assert.equal(memQueue.getQueueDepth(tenantId, 1100), 3, "3 rehydrated");

    // Phase 3: Dequeue (simulating client reconnect + successful flush)
    const flushed = dequeueAllDlrsPersist(tenantId, 1100, schemaName);
    assert.equal(flushed.length, 3, "all 3 dequeued");
    assert.equal(memQueue.getQueueDepth(tenantId, 1100), 0, "memory empty");
    await awaitDbCount(1100, 0);
  });

  await test("lifecycle: enqueue → dequeue (partial failure) → requeue → dequeue again", async () => {
    const { tenantId } = await getTestContext();
    const dlr1 = makeDlr({ messageId: "partial-ok" });
    const dlr2 = makeDlr({ messageId: "partial-fail" });

    enqueueDlrPersist(tenantId, 1101, ctx!.schemaName, dlr1);
    enqueueDlrPersist(tenantId, 1101, ctx!.schemaName, dlr2);
    await awaitDbCount(1101, 2);

    // Dequeue all
    const flushed = dequeueAllDlrsPersist(tenantId, 1101, ctx!.schemaName);
    assert.equal(flushed.length, 2);
    await awaitDbCount(1101, 0);

    // Simulate: dlr1 sent OK, dlr2 failed — re-queue dlr2
    requeueDlrsPersist(tenantId, 1101, ctx!.schemaName, [flushed[1]]);
    await awaitDbCount(1101, 1);
    assert.equal(memQueue.getQueueDepth(tenantId, 1101), 1, "one re-queued");

    // Second dequeue attempt
    const flushed2 = dequeueAllDlrsPersist(tenantId, 1101, ctx!.schemaName);
    assert.equal(flushed2.length, 1);
    assert.equal(flushed2[0].messageId, "partial-fail");
    await awaitDbCount(1101, 0);
  });

  await test("lifecycle: cleanup interval is created and stops", async () => {
    // Verify startDlrCleanupPersist returns an interval handle
    const handle = startDlrCleanupPersist(60_000); // 1 minute interval
    assert.ok(handle && typeof handle.refresh === "function", "should return a valid Timeout with refresh method");

    // Clean up — don't leave a running interval
    clearInterval(handle);
  });
}

// ═══════════════════════════════════════════════════════════
// Run all suites
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log("DLR Queue Persistence Integration Tests");
  console.log("═══════════════════════════════════════");

  try {
    await getTestContext();
  } catch (err) {
    console.error("  ❌ Cannot connect to database:", (err as Error).message);
    console.error("  Make sure PostgreSQL is running and DATABASE_URL is set.");
    process.exit(1);
  }

  await suiteEnqueue();
  await suiteDequeue();
  await suiteRequeue();
  await suiteLoadFromDb();
  await suiteCleanup();
  await suiteLifecycle();

  // Final cleanup
  memQueue.clearAllQueues();
  await clearDb();

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
