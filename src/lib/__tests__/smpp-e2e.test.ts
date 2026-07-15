/**
 * End-to-End SMPP Integration Tests
 *
 * Starts the SMSC server on a random port, creates a test SMPP client in the DB,
 * connects real SMPP ESME clients, and tests the full lifecycle:
 *
 *  1. bind_transceiver  → success
 *  2. bind_transmitter  → success
 *  3. bind_receiver     → success + DLR flush
 *  4. bind rejection    → wrong password
 *  5. bind rejection    → unknown system_id
 *  6. enquire_link      → keepalive
 *  7. unbind            → session removed
 *  8. DLR queue         → queue while disconnected, flush on rebind
 *  9. submit_sm         → rejected (no route plan)
 *
 * Run:  npx tsx src/lib/__tests__/smpp-e2e.test.ts
 *
 * Prerequisites: PostgreSQL running, .env with DATABASE_URL, at least 1 active tenant
 */
import assert from "node:assert/strict";
import { createServer as createNetServer } from "node:net";
import { pool } from "@/db";
import { startSmppServer, isClientSessionActive } from "@/lib/smpp-server";
import * as memQueue from "@/lib/dlr-queue";
import { enqueueDlrPersist, stopDlrCleanupPersist } from "@/lib/dlr-queue-persist";
import type { DlrPayload } from "@/lib/smpp-client";

const smppLib = require("smpp");

// ── Test context ──

interface TestContext {
  tenantId: number;
  schemaName: string;
  clientId: number;
  smppUsername: string;
  smppPassword: string;
  server: ReturnType<typeof startSmppServer>;
  port: number;
}

let ctx: TestContext | null = null;

async function findPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createNetServer();
    srv.listen(0, () => {
      const port = (srv.address() as { port: number }).port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function getTestContext(): Promise<TestContext> {
  if (ctx) return ctx;

  const client = await pool.connect();
  let tenantId: number;
  let schemaName: string;
  try {
    const { rows: tenants } = await client.query(
      "SELECT id, schema_name FROM tenants WHERE is_active = true ORDER BY id LIMIT 1"
    );
    if (tenants.length === 0) throw new Error("No active tenants");
    tenantId = tenants[0].id;
    schemaName = tenants[0].schema_name;
  } finally {
    client.release();
  }

  // SMPP protocol limits: system_id ≤ 15 chars, password ≤ 8 chars.
  // Using Date.now().toString(36) base-36 to keep under the limit.
  const ts = Date.now().toString(36).slice(-8);
  const smppUsername = ("e" + ts).slice(0, 15);  // ≤ 15 chars
  const smppPassword = "ep" + ts.slice(0, 6);    // ≤ 8 chars

  const tc = await pool.connect();
  let clientId: number;
  try {
    await tc.query(`SET search_path TO "${schemaName}"`);
    const { rows } = await tc.query(
      `INSERT INTO clients (name, email, phone, connection_type, smpp_username, smpp_password, smpp_allowed_ip, is_active)
       VALUES ($1, $2, $3, 'SMPP', $4, $5, NULL, true)
       RETURNING id`,
      [`E2E Test`, `${smppUsername}@test.local`, "+254700000000", smppUsername, smppPassword]
    );
    clientId = rows[0].id;
    console.log(`  Created test client #${clientId}: ${smppUsername}`);
  } finally {
    await tc.query("SET search_path TO public");
    tc.release();
  }

  const port = await findPort();
  const server = startSmppServer(port);
  await new Promise((r) => setTimeout(r, 500));
  console.log(`  SMSC listening on port ${port}`);

  ctx = { tenantId, schemaName, clientId, smppUsername, smppPassword, server, port };
  return ctx;
}

async function cleanupContext(): Promise<void> {
  if (!ctx) return;
  const { server, schemaName, clientId } = ctx;

  try { server.close(); } catch (err) { console.error("Error closing server:", err); }

  const c = await pool.connect();
  try {
    await c.query(`SET search_path TO "${schemaName}"`);
    await c.query("DELETE FROM clients WHERE id = $1", [clientId]);
    await c.query("DELETE FROM pending_dlrs WHERE client_id = $1", [clientId]);
  } catch (err) { console.error("Error cleaning up DB:", err); }
  finally {
    await c.query("SET search_path TO public");
    c.release();
  }

  try { stopDlrCleanupPersist(); } catch (err) { console.error("Error stopping DLR cleanup:", err); }
  memQueue.clearAllQueues();
  ctx = null;
}

// ── Retry helper ──

async function waitFor(fn: () => boolean | Promise<boolean>, label: string, maxRetries = 30): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timeout waiting for: ${label}`);
}

// ── SMPP client helpers ──

function smppConnect(port: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const session = smppLib.connect(`esms://127.0.0.1:${port}`);
    const timeout = setTimeout(() => {
      try { session.close(); } catch {}
      reject(new Error("SMPP connect timeout"));
    }, 5000);
    session.on("connect", () => { clearTimeout(timeout); resolve(session); });
    session.on("error", (err: Error) => { clearTimeout(timeout); reject(err); });
  });
}

function smppBind(session: any, event: string, pdu: Record<string, unknown>): Promise<{ command_status: number; message_id?: string }> {
  return new Promise((resolve) => {
    session.send(new smppLib.PDU(event, pdu), (resp: any) => {
      resolve({ command_status: resp.command_status, message_id: resp.message_id });
    });
  });
}

// ── Test runner ──

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
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
// SUITE 1: Bind Success
// ═══════════════════════════════════════════════════════════

async function suiteBindSuccess() {
  console.log("\n── Bind: Success ──");

  await test("bind_transceiver succeeds", async () => {
    const { smppUsername, smppPassword, port, clientId, schemaName } = await getTestContext();
    const session = await smppConnect(port);
    const resp = await smppBind(session, "bind_transceiver", { system_id: smppUsername, password: smppPassword });
    assert.equal(resp.command_status, 0, `bind_transceiver failed with status ${resp.command_status}`);
    assert.equal(isClientSessionActive(clientId, schemaName), true, "session active");
    try { session.close(); } catch {}
  });

  await test("bind_transmitter succeeds", async () => {
    const { smppUsername, smppPassword, port, clientId, schemaName } = await getTestContext();
    const session = await smppConnect(port);
    const resp = await smppBind(session, "bind_transmitter", { system_id: smppUsername, password: smppPassword });
    assert.equal(resp.command_status, 0, `bind_transmitter failed with status ${resp.command_status}`);
    assert.equal(isClientSessionActive(clientId, schemaName), true, "session active");
    try { session.close(); } catch {}
  });

  await test("bind_receiver succeeds", async () => {
    const { smppUsername, smppPassword, port, clientId, schemaName } = await getTestContext();
    const session = await smppConnect(port);
    const resp = await smppBind(session, "bind_receiver", { system_id: smppUsername, password: smppPassword });
    assert.equal(resp.command_status, 0, `bind_receiver failed with status ${resp.command_status}`);
    assert.equal(isClientSessionActive(clientId, schemaName), true, "session active");
    try { session.close(); } catch {}
  });
}

// ═══════════════════════════════════════════════════════════
// SUITE 2: Bind Rejection
// ═══════════════════════════════════════════════════════════

async function suiteBindRejection() {
  console.log("\n── Bind: Rejection ──");

  await test("wrong password → ESME_RBINDFAIL (14)", async () => {
    const { smppUsername, port } = await getTestContext();
    const session = await smppConnect(port);
    const resp = await smppBind(session, "bind_transceiver", { system_id: smppUsername, password: "wrong" });
    assert.equal(resp.command_status, 14, "ESME_RBINDFAIL for wrong password");
    try { session.close(); } catch {}
  });

  await test("empty password rejected when DB has one", async () => {
    const { smppUsername, port } = await getTestContext();
    const session = await smppConnect(port);
    const resp = await smppBind(session, "bind_transceiver", { system_id: smppUsername, password: "" });
    assert.equal(resp.command_status, 14, "ESME_RBINDFAIL for empty password");
    try { session.close(); } catch {}
  });

  await test("unknown system_id → ESME_RBINDFAIL", async () => {
    const { port } = await getTestContext();
    const session = await smppConnect(port);
    const resp = await smppBind(session, "bind_transceiver", { system_id: "nonexistent_xyz", password: "x" });
    assert.equal(resp.command_status, 14, "ESME_RBINDFAIL for unknown user");
    try { session.close(); } catch {}
  });
}

// ═══════════════════════════════════════════════════════════
// SUITE 3: enquire_link + unbind
// ═══════════════════════════════════════════════════════════

async function suiteEnquireAndUnbind() {
  console.log("\n── enquire_link + unbind ──");

  await test("enquire_link returns OK", async () => {
    const { smppUsername, smppPassword, port } = await getTestContext();
    const session = await smppConnect(port);
    await smppBind(session, "bind_transceiver", { system_id: smppUsername, password: smppPassword });
    const resp =    await smppBind(session, "enquire_link", {});
    assert.equal(resp.command_status, 0, "enquire_link OK");
    try { session.close(); } catch {}
  });

  await test("unbind closes session", async () => {
    const { smppUsername, smppPassword, port, clientId, schemaName } = await getTestContext();
    const session = await smppConnect(port);
    await smppBind(session, "bind_transceiver", { system_id: smppUsername, password: smppPassword });
    assert.equal(isClientSessionActive(clientId, schemaName), true, "bound");

    await smppBind(session, "unbind", {});
    try { session.close(); } catch {}

    await waitFor(() => !isClientSessionActive(clientId, schemaName), "session to become inactive");
    assert.equal(isClientSessionActive(clientId, schemaName), false, "unbound");
  });

  await test("submit_sm without route plan → ESME_RSUBMITFAIL (8)", async () => {
    const { smppUsername, smppPassword, port } = await getTestContext();
    const session = await smppConnect(port);
    await smppBind(session, "bind_transceiver", { system_id: smppUsername, password: smppPassword });

    const resp = await smppBind(session, "submit_sm", {
      source_addr: "Test", destination_addr: "254712345678",
      short_message: { message: "Hello" },
    });
    assert.equal(resp.command_status, 8, "ESME_RSUBMITFAIL — no route plan");
    try { session.close(); } catch {}
  });
}

// ═══════════════════════════════════════════════════════════
// SUITE 4: DLR Queue E2E
// ═══════════════════════════════════════════════════════════

async function suiteDlrQueue() {
  console.log("\n── DLR Queue E2E ──");

  // Clean queue state before DLR tests
  const { clientId, tenantId, schemaName } = await getTestContext();
  memQueue.clearAllQueues();

  await test("DLRs queued while disconnected are flushed on receiver rebind", async () => {
    const { smppUsername, smppPassword, port } = ctx!;

    // Bind then disconnect
    const s1 = await smppConnect(port);
    await smppBind(s1, "bind_transceiver", { system_id: smppUsername, password: smppPassword });
    try { s1.close(); } catch {}
    await waitFor(() => !isClientSessionActive(clientId, schemaName), "disconnect");

    // Queue a DLR
    const dlr: DlrPayload = {
      messageId: "e2e-dlr-rx", supplierMessageId: "sup-rx", status: "DELIVRD",
      submitDate: String(Math.floor(Date.now() / 1000)), doneDate: String(Math.floor(Date.now() / 1000) + 1),
      errorCode: "000", dest: "254712345678", src: "E2E",
    };
    enqueueDlrPersist(tenantId, clientId, schemaName, dlr);
    assert.equal(memQueue.getQueueDepth(tenantId, clientId), 1, "DLR queued");

    // Reconnect as receiver → flushPendingDlrs should dequeue the DLR
    const s2 = await smppConnect(port);
    await smppBind(s2, "bind_receiver", { system_id: smppUsername, password: smppPassword });

    // After bind, flushPendingDlrs should have dequeued all DLRs
    await waitFor(() => memQueue.getQueueDepth(tenantId, clientId) === 0, "DLR queue to be flushed");
    assert.equal(memQueue.getQueueDepth(tenantId, clientId), 0, "queue empty after flush");
    try { s2.close(); } catch {}
  });

  await test("DLRs queued while disconnected are flushed on transceiver rebind", async () => {
    const { smppUsername, smppPassword, port } = ctx!;

    const s1 = await smppConnect(port);
    await smppBind(s1, "bind_transceiver", { system_id: smppUsername, password: smppPassword });
    try { s1.close(); } catch {}
    await waitFor(() => !isClientSessionActive(clientId, schemaName), "disconnect for TRX test");

    const dlr: DlrPayload = {
      messageId: "e2e-dlr-trx", supplierMessageId: "sup-trx", status: "UNDELIV",
      submitDate: String(Math.floor(Date.now() / 1000)), doneDate: String(Math.floor(Date.now() / 1000) + 2),
      errorCode: "005", dest: "254799988877", src: "TRX",
    };
    enqueueDlrPersist(tenantId, clientId, schemaName, dlr);
    assert.equal(memQueue.getQueueDepth(tenantId, clientId), 1, "DLR queued");

    // Reconnect as transceiver → flushPendingDlrs should dequeue the DLR
    const s2 = await smppConnect(port);
    await smppBind(s2, "bind_transceiver", { system_id: smppUsername, password: smppPassword });

    await waitFor(() => memQueue.getQueueDepth(tenantId, clientId) === 0, "DLR queue flushed on TRX rebind");
    assert.equal(memQueue.getQueueDepth(tenantId, clientId), 0, "queue empty after TRX flush");
    try { s2.close(); } catch {}
  });
}

// ═══════════════════════════════════════════════════════════
// Run
// ═══════════════════════════════════════════════════════════

async function main() {
  console.log("SMPP End-to-End Integration Tests");
  console.log("══════════════════════════════════");

  let setupFailed = false;

  try {
    await getTestContext();
  } catch (err) {
    console.error("  ❌ Setup failed:", (err as Error).message);
    setupFailed = true;
  }

  if (!setupFailed) {
    try {
      await suiteBindSuccess();
      await suiteBindRejection();
      await suiteEnquireAndUnbind();
      await suiteDlrQueue();
    } catch (err) {
      console.error("  ❌ Suite error:", (err as Error).message);
    }
  }

  await cleanupContext();

  console.log(`\n── Results ──`);
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total:  ${passed + failed}`);
  if (setupFailed || failed > 0) { console.error(`\n❌ ${setupFailed ? "SETUP FAILED" : `${failed} test(s) FAILED`}`); process.exit(1); }
  else { console.log(`\n✅ All tests passed!`); process.exit(0); }
}

main();
