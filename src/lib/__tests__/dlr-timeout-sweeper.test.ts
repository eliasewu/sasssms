/**
 * Unit tests for the stale-DLR timeout sweeper decision logic.
 *
 * Covers the Custom Server Billing Matrix rules:
 *  - on_dlr pending past window → fail (FAILED / undelivered, no charge)
 *  - force_dlr_timeout involved → deliver (fake DELIVRD, charge client)
 *  - on_submit → skip (already billed at submit)
 *  - window honors per-client/supplier dlr_timeout with a 5-minute default
 */
import assert from "node:assert";
import { isBusinessApiRoute } from "@/lib/connection-types";
import { resolveStaleDlrAction, sweepTenantStaleDlrs } from "@/lib/dlr-timeout-sweeper";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${name}:`, (e as Error).message);
  }
}

async function main() {
console.log("\n── DLR Timeout Sweeper Decision Logic ──");

// ── on_dlr: pending past 5-min window → fail/undelivered ──
await test("on_dlr client pending 500s (default 300s window) → fail", () => {
  const r = resolveStaleDlrAction({
    clientChargingMode: "on_dlr",
    supplierChargingMode: "on_submit",
    ageSeconds: 500,
    clientTimeout: 300,
    supplierTimeout: 300,
  });
  assert.equal(r.action, "fail");
  assert.equal(r.due, true);
});

await test("on_dlr client pending 100s (default 300s window) → not due", () => {
  const r = resolveStaleDlrAction({
    clientChargingMode: "on_dlr",
    supplierChargingMode: "on_submit",
    ageSeconds: 100,
    clientTimeout: 300,
    supplierTimeout: 300,
  });
  assert.equal(r.action, "fail");
  assert.equal(r.due, false);
});

await test("on_dlr client with custom 600s timeout pending 500s → not due", () => {
  const r = resolveStaleDlrAction({
    clientChargingMode: "on_dlr",
    supplierChargingMode: null,
    ageSeconds: 500,
    clientTimeout: 600,
    supplierTimeout: null,
  });
  assert.equal(r.windowSeconds, 600);
  assert.equal(r.due, false);
});

// ── force_dlr_timeout: pending past window → deliver (fake DELIVRD) ──
await test("force_dlr_timeout client pending past window → deliver", () => {
  const r = resolveStaleDlrAction({
    clientChargingMode: "force_dlr_timeout",
    supplierChargingMode: "on_submit",
    ageSeconds: 500,
    clientTimeout: 300,
    supplierTimeout: 300,
  });
  assert.equal(r.action, "deliver");
  assert.equal(r.due, true);
});

await test("force_dlr_timeout supplier + on_submit client → deliver", () => {
  const r = resolveStaleDlrAction({
    clientChargingMode: "on_submit",
    supplierChargingMode: "force_dlr_timeout",
    ageSeconds: 400,
    clientTimeout: 300,
    supplierTimeout: 300,
  });
  assert.equal(r.action, "deliver");
});

await test("force mode uses tighter window (client 600 / supplier 120)", () => {
  const r = resolveStaleDlrAction({
    clientChargingMode: "on_dlr",
    supplierChargingMode: "force_dlr_timeout",
    ageSeconds: 150,
    clientTimeout: 600,
    supplierTimeout: 120,
  });
  assert.equal(r.action, "deliver");
  assert.equal(r.windowSeconds, 120);
  assert.equal(r.due, true);
});

// ── on_submit: never touched ──
await test("on_submit client → skip (already billed at submit)", () => {
  const r = resolveStaleDlrAction({
    clientChargingMode: "on_submit",
    supplierChargingMode: "on_submit",
    ageSeconds: 99999,
    clientTimeout: 300,
    supplierTimeout: 300,
  });
  assert.equal(r.action, "skip");
});

await test("force_dlr (no timeout) client → skip (resolved at submit)", () => {
  const r = resolveStaleDlrAction({
    clientChargingMode: "force_dlr",
    supplierChargingMode: "on_submit",
    ageSeconds: 99999,
    clientTimeout: 300,
    supplierTimeout: 300,
  });
  assert.equal(r.action, "skip");
});

// ── sane floor: never resolve before 60s ──
await test("timeout floor of 60s (tiny configured timeouts don't churn)", () => {
  const r = resolveStaleDlrAction({
    clientChargingMode: "on_dlr",
    supplierChargingMode: null,
    ageSeconds: 65,
    clientTimeout: 10,
    supplierTimeout: null,
  });
  assert.equal(r.windowSeconds, 60);
  assert.equal(r.due, true);
});

// ── Business API flow: charged at submit, no DLR path ──
// The sweeper short-circuits Business API rows entirely (see
// sweepTenantStaleDlrs) — their outcome is resolved by the send paths
// (DELIVERED/FAILED/REJECTED), so any legacy SENT row must be skipped, never
// failed after submit-billing and never force-delivered. These tests document
// the two failure modes the short-circuit prevents.
await test("Business API on_dlr client would fail+no-charge without short-circuit (forbidden)", () => {
  // Documents WHY the sweeper skips Business API rows: without it, an on_dlr
  // client would be failed + uncharged even though Business API is billed at
  // submit.
  const r = resolveStaleDlrAction({
    clientChargingMode: "on_dlr",
    supplierChargingMode: null,
    ageSeconds: 99999,
    clientTimeout: 300,
    supplierTimeout: null,
  });
  assert.equal(r.action, "fail");
});

await test("force_dlr_timeout supplier would deliver without short-circuit (forbidden)", () => {
  // Documents the supplier-force gap: the decision function considers client
  // OR supplier force mode, so a force_dlr_timeout supplier alone would force
  // DELIVRD — the sweeper's Business API short-circuit prevents fabricating a
  // delivery for an unknown-outcome row.
  const r = resolveStaleDlrAction({
    clientChargingMode: "on_submit",
    supplierChargingMode: "force_dlr_timeout",
    ageSeconds: 99999,
    clientTimeout: 300,
    supplierTimeout: 300,
  });
  assert.equal(r.action, "deliver");
});

// ── Business API short-circuit gate (isBusinessApiRoute) — the actual
//    decision the sweeper makes on each candidate row, extracted so it can be
//    unit-tested directly without a database.
await test("isBusinessApiRoute: matches exact 'Business API' type", () => {
  assert.equal(isBusinessApiRoute("Business API"), true);
});

await test("isBusinessApiRoute: case-insensitive (BUSINESS API / business api)", () => {
  assert.equal(isBusinessApiRoute("BUSINESS API"), true);
  assert.equal(isBusinessApiRoute("business api"), true);
});

await test("isBusinessApiRoute: rejects other connection types", () => {
  assert.equal(isBusinessApiRoute("SMPP"), false);
  assert.equal(isBusinessApiRoute("CUSTOM_API"), false);
  assert.equal(isBusinessApiRoute("WhatsApp OTT"), false);
  assert.equal(isBusinessApiRoute("HTTP API"), false);
  assert.equal(isBusinessApiRoute("Voice OTP"), false);
});

await test("isBusinessApiRoute: null/undefined/empty never match", () => {
  assert.equal(isBusinessApiRoute(null), false);
  assert.equal(isBusinessApiRoute(undefined), false);
  assert.equal(isBusinessApiRoute(""), false);
});

await test("isBusinessApiRoute: partial strings don't match (no prefix/suffix leak)", () => {
  assert.equal(isBusinessApiRoute("Business API Connector"), false);
  assert.equal(isBusinessApiRoute("My Business API"), false);
  assert.equal(isBusinessApiRoute("BUSINESS_API"), false); // underscore form ≠ space form
});

// ── Integration: full sweep loop with an injected fake DB client ──
// Drives sweepTenantStaleDlrs end-to-end (candidate query → per-row decision)
// against a fake client that only implements the query/release shape used by
// the sweeper, so we can assert the REAL loop skips Business API rows and
// counts them in skipped++ without issuing any UPDATE.

// Build a fake pg client. `rowsBySql` matches on SQL fragments: the candidate
// query returns `candidates`, the clients query returns `clientRows` keyed by
// id. Any other query returns empty rows; all statements are recorded so the
// test can assert no UPDATE was ever issued for the skipped row.
function makeFakeClient(opts: {
  candidates: Record<string, unknown>[];
  clientRows?: Record<number, Record<string, unknown>>;
  // Number of Business API stale rows the real SQL would exclude — the fake
  // answers the sweeper's COUNT(*) exclusion query with this value.
  excludedBusinessApi?: number;
}) {
  const statements: string[] = [];
  const client = {
    async query(text: string, params?: unknown[]) {
      statements.push(text);
      // Exclusion COUNT query (runs before the candidate SELECT).
      if (text.includes("COUNT(*)") && text.includes("excluded_count")) {
        return { rows: [{ excluded_count: opts.excludedBusinessApi ?? 0 }], rowCount: 1 };
      }
      if (text.includes("FROM messages m")) return { rows: opts.candidates, rowCount: opts.candidates.length };
      if (text.includes("FROM clients WHERE")) {
        const id = Number(params?.[0]);
        const row = opts.clientRows?.[id];
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }
      if (text.includes("FROM suppliers WHERE")) return { rows: [], rowCount: 0 };
      if (text.includes("UPDATE messages")) return { rows: [], rowCount: 1 }; // claim the row
      if (text.includes("UPDATE tenants")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
  return { client, statements };
}

const staleAge = new Date(Date.now() - 600_000).toISOString(); // 10 min old

await test("sweepTenantStaleDlrs: Business API SENT row excluded at SQL level, counted via exclusion query (skipped++)", async () => {
  const { client, statements } = makeFakeClient({
    // Business API rows never appear in the candidate set — the SQL excludes
    // them, exactly like CUSTOM_API. The fake's candidates are therefore empty
    // and the exclusion COUNT reports the 1 stale Business API row.
    candidates: [],
    excludedBusinessApi: 1,
    clientRows: {
      10: { charging_mode: "on_dlr", force_dlr: false, billing_mode: "dlr", dlr_timeout: 300, connection_type: "SMPP" },
    },
  });

  const result = await sweepTenantStaleDlrs(1, "test_schema", () => Promise.resolve(client));

  assert.equal(result.resolved, 0, "Business API rows are never auto-resolved");
  assert.equal(result.skipped, 1, "excluded Business API row must be counted in skipped++ via the COUNT query");

  // The killer assertion: the loop must NOT have attempted any UPDATE — neither
  // a FAILED flip (billed at submit) nor a forced DELIVERED. It only ran the
  // candidate SELECT + the exclusion COUNT.
  const updates = statements.filter((s) => s.includes("UPDATE"));
  assert.deepEqual(updates, [], "no UPDATE should be issued for an excluded Business API row");
  assert.ok(statements.some((s) => s.includes("excluded_count")), "Business API exclusion COUNT query ran");
  assert.ok(statements.some((s) => s.includes("FROM messages m") && !s.includes("COUNT(*)")), "candidate SELECT ran");
});

await test("sweepTenantStaleDlrs: PENDING Business API rows excluded at SQL level; non-Business-API rows still swept", async () => {
  const { client, statements } = makeFakeClient({
    // Both Business API rows are excluded by the SQL — only the SMPP row is a
    // candidate. The exclusion COUNT reports the 2 excluded Business API rows.
    candidates: [
      {
        // Non-Business-API row (SMPP, on_dlr, stale) — must still be processed
        // by the generic path so the sweep keeps working alongside the gate.
        id: 3, message_id: "msg-smpp-3", client_id: 10, supplier_id: 20,
        sender: "N2APP", destination: "+8801733333333",
        connection_type: "SMPP", dlr_callback_url: null,
        created_at: staleAge, cost: "0.05", supplier_cost: "0.03",
      },
    ],
    excludedBusinessApi: 2,
    // Client type HTTP (not SMPP) so the forced-DLR path doesn't enqueue an
    // SMPP persist — keeps the test hermetic (no real-DB fire-and-forget).
    clientRows: {
      10: { charging_mode: "on_dlr", force_dlr: false, billing_mode: "dlr", dlr_timeout: 300, connection_type: "HTTP API" },
    },
  });

  const result = await sweepTenantStaleDlrs(1, "test_schema", () => Promise.resolve(client));

  // 2 Business API excluded (counted in skipped) + 1 SMPP failed (on_dlr stale)
  // → resolved 1, skipped 2.
  assert.equal(result.resolved, 1, "non-Business-API stale on_dlr row is failed normally");
  assert.equal(result.skipped, 2, "both excluded Business API rows counted in skipped++");

  const updates = statements.filter((s) => s.includes("UPDATE messages"));
  assert.equal(updates.length, 1, "only the SMPP row gets an UPDATE");
  assert.ok(updates[0].includes("FAILED"), "SMPP row fails with DLR_TIMEOUT");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
