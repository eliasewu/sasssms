/**
 * Stale DLR Timeout Sweeper
 *
 * Background worker that resolves messages stuck in SENT/PENDING (no real DLR
 * received) across ALL flows — SMPP, HTTP API, CUSTOM_API, WhatsApp/Telegram
 * OTT, Business API — after the client/supplier dlr_timeout window (default
 * 300s = 5 minutes).
 *
 * Billing rules (Custom_Server_Billing_Matrix_Submit_DLR_Force.xlsx):
 *
 *  ── force_dlr_timeout active (client OR supplier) ──
 *     Timer exceeds force-DLR timeout while pending:
 *       • Client → charged (immediately if force_dlr_timeout, or on timeout
 *         when the client side is on_dlr).
 *       • Supplier → ZERO payout unless the SUPPLIER's own charging mode is
 *         force_dlr / force_dlr_timeout (margin isolation — rule 2).
 *       • Fake DELIVRD pushed to the client (HTTP webhook + SMPP queue).
 *
 *  ── plain on_dlr client (no force) ──
 *     Pending past the window → marked FAILED, FAIL/undelivered DLR pushed,
 *     NO charge to the client, NO supplier payout.
 *
 *  ── on_submit client ──
 *     Already billed at submit (standard wholesale model) — never touched.
 *
 *  ── Business API ──
 *     Charged at submit (no real DLR path — success is stored DELIVERED by the
 *     send paths), so any legacy/stuck SENT row is skipped entirely — never
 *     flipped to FAILED (client was billed) and never force-delivered with an
 *     unconfirmable outcome.
 *
 * Every forced result is flagged with messages.dlr_source:
 *   'FORCE_TIMEOUT' — synthetic DELIVERED from the timeout timer
 *   'DLR_TIMEOUT'   — FAILED because no real DLR arrived within the window
 */
import { pool } from "@/db";
import type { PoolClient } from "pg";
import { isBusinessApiRoute } from "@/lib/connection-types";
import { lookupClientRate, lookupSupplierCost } from "@/lib/rates";
import {
  resolveChargingMode,
  isDlrCharged,
  isForceDlr,
  isForceDlrTimeout,
} from "@/lib/charging";
import type { ChargingMode } from "@/lib/charging";
import type { DlrPayload } from "@/lib/smpp-client";
import { enqueueDlrPersist } from "@/lib/dlr-queue-persist";
import { pushDlrToClient } from "@/lib/voice-otp-dlr";

const SWEEP_INTERVAL_MS = 60_000; // every 60s
const MIN_WINDOW_SECONDS = 60; // never resolve earlier than 60s
const DEFAULT_TIMEOUT_SECONDS = 300; // 5 minutes

interface StaleMessage {
  id: number;
  message_id: string;
  client_id: number;
  supplier_id: number | null;
  sender: string;
  destination: string;
  connection_type: string | null;
  dlr_callback_url: string | null;
  created_at: string;
  cost: string;
  supplier_cost: string;
}

/**
 * Pure decision logic — returns what to do for one stale message.
 * Factored out so it can be unit-tested without a database.
 */
export function resolveStaleDlrAction(args: {
  clientChargingMode: ChargingMode;
  supplierChargingMode: ChargingMode | null;
  ageSeconds: number;
  clientTimeout: number;
  supplierTimeout: number | null;
}): { action: "deliver" | "fail" | "skip"; windowSeconds: number; due: boolean } {
  const clientTimeout = args.clientTimeout > 0 ? args.clientTimeout : DEFAULT_TIMEOUT_SECONDS;
  const supplierTimeout =
    args.supplierTimeout && args.supplierTimeout > 0 ? args.supplierTimeout : clientTimeout;

  // Force mode uses the tighter of the two windows (existing send-path behavior)
  const forceInvolved =
    isForceDlrTimeout(args.clientChargingMode) || isForceDlrTimeout(args.supplierChargingMode || "on_submit");
  const windowSeconds = Math.max(
    MIN_WINDOW_SECONDS,
    forceInvolved ? Math.min(clientTimeout, supplierTimeout) : clientTimeout
  );
  const due = args.ageSeconds >= windowSeconds;

  if (forceInvolved) return { action: "deliver", windowSeconds, due };
  if (isDlrCharged(args.clientChargingMode)) return { action: "fail", windowSeconds, due };
  // on_submit (and everything else): already billed — leave untouched
  return { action: "skip", windowSeconds, due };
}

/** Push a forced DLR out over HTTP webhook and/or the SMPP pending queue. */
async function pushForcedDlr(args: {
  msg: StaleMessage;
  schemaName: string;
  tenantId: number;
  clientId: number;
  status: "DELIVERED" | "FAILED"; // HTTP status
  smppStat: "DELIVRD" | "UNDELIV"; // SMPP stat code
  cost: number;
  force: boolean;
  enqueueSMPP: boolean; // client is an SMPP ESME — queue DLR for next bind
}) {
  const { msg, schemaName, tenantId, clientId, status, smppStat, cost, force, enqueueSMPP } = args;
  const timestamp = new Date().toISOString();

  // HTTP webhook (SMPP + HTTP + OTT clients all may have a callback URL)
  if (msg.dlr_callback_url) {
    pushDlrToClient(
      msg.dlr_callback_url,
      {
        message_id: msg.message_id,
        destination: msg.destination,
        source: msg.sender,
        status,
        cost,
        timestamp,
        force_dlr: force,
        dlr_source: force ? "FORCE_TIMEOUT" : "DLR_TIMEOUT",
      },
      schemaName
    ).catch(() => {});
  }

  // SMPP ESME clients receive the DLR when they next bind (queued in memory + DB).
  // Gated on the CLIENT's type — the message's route connection_type is the
  // supplier's type and may differ (e.g. SMPP client → HTTP-API supplier).
  if (enqueueSMPP) {
    const dlr: DlrPayload = {
      messageId: msg.message_id,
      supplierMessageId: msg.message_id,
      status: smppStat,
      submitDate: String(Math.floor(new Date(msg.created_at).getTime() / 1000)),
      doneDate: String(Math.floor(Date.now() / 1000)),
      errorCode: smppStat === "DELIVRD" ? "000" : "999",
      dest: msg.destination,
      src: msg.sender,
    };
    enqueueDlrPersist(tenantId, clientId, schemaName, dlr);
  }
}

/**
 * Sweep one tenant's stale SENT/PENDING messages and resolve them per billing
 * matrix. Safe to call repeatedly — each message resolves exactly once.
 *
 * @param connect  optional client factory for tests (defaults to the real
 *                 pool). Returning an object with the same `query`/`release`
 *                 shape lets tests drive the full sweep loop without a DB.
 */
export async function sweepTenantStaleDlrs(
  tenantId: number,
  schemaName: string,
  connect?: () => Promise<{
    query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount?: number | null }>;
    release: () => void;
  }>
): Promise<{ resolved: number; skipped: number }> {
  // Cast through unknown so an injected fake client (which only implements the
  // query/release shape used below) is accepted while callers that pass the
  // real PoolClient keep full type safety.
  const client = connect ? ((await connect()) as unknown as PoolClient) : await pool.connect();
  let resolved = 0;
  let skipped = 0;
  try {
    await client.query(`SET search_path TO "${schemaName}"`);

    // Stale candidates: older than the minimum window, still awaiting DLR.
    // CUSTOM_API and Business API are excluded — CUSTOM_API timeouts belong to
    // the dedicated dlr-poller (duplicate FAILED webhooks otherwise), and
    // Business API is billed at submit with no DLR path (outcome already
    // resolved by the send paths), so both are skipped at the SQL level.
    const { rows } = await client.query(
      `SELECT m.id, m.message_id, m.client_id, m.supplier_id, m.sender, m.destination,
              m.connection_type, m.dlr_callback_url, m.created_at, m.cost, m.supplier_cost
       FROM messages m
       WHERE m.dlr_status IN ('SENT', 'PENDING')
         AND m.status NOT IN ('FAILED', 'REJECTED')
         AND UPPER(COALESCE(m.connection_type, '')) <> 'CUSTOM_API'
         AND UPPER(COALESCE(m.connection_type, '')) <> 'BUSINESS API'
         AND m.created_at < NOW() - ($1 * INTERVAL '1 second')
       ORDER BY m.created_at ASC
       LIMIT 200`,
      [MIN_WINDOW_SECONDS]
    );

    // Count the Business API rows that would have been candidates (same stale
    // criteria) so the returned `skipped` tally stays accurate even though the
    // rows themselves are excluded from the sweep above.
    try {
      const excluded = await client.query(
        `SELECT COUNT(*)::int AS excluded_count
         FROM messages m
         WHERE m.dlr_status IN ('SENT', 'PENDING')
           AND m.status NOT IN ('FAILED', 'REJECTED')
           AND UPPER(COALESCE(m.connection_type, '')) = 'BUSINESS API'
           AND m.created_at < NOW() - ($1 * INTERVAL '1 second')`,
        [MIN_WINDOW_SECONDS]
      );
      skipped += Number(excluded.rows[0]?.excluded_count || 0);
    } catch (err) {
      // Best-effort tally — never let the counter query break the sweep.
      console.error(`[DLR-SWEEP] ${schemaName}: Business API exclusion count failed:`, err);
    }

    for (const row of rows) {
      const msg = row as unknown as StaleMessage;
      const ageSeconds =
        (Date.now() - new Date(msg.created_at).getTime()) / 1000;

      // Client charging mode + timeout (+ SMPP ESME detection for DLR queueing)
      let clientMode: ChargingMode = "on_submit";
      let clientTimeout = DEFAULT_TIMEOUT_SECONDS;
      let clientIsSmpp = false;
      try {
        const { rows: c } = await client.query(
          "SELECT charging_mode, force_dlr, billing_mode, dlr_timeout, connection_type FROM clients WHERE id = $1",
          [msg.client_id]
        );
        if (c.length > 0) {
          clientMode = resolveChargingMode(c[0]);
          clientTimeout = parseInt(c[0].dlr_timeout as string || String(DEFAULT_TIMEOUT_SECONDS), 10) || DEFAULT_TIMEOUT_SECONDS;
          clientIsSmpp = String(c[0].connection_type || "").toUpperCase() === "SMPP";
        }
      } catch { /* keep defaults */ }

      // ── Business API defensive backstop ──
      // Business API rows are excluded at the SQL level and counted into
      // `skipped` by the COUNT query above — that query is the SINGLE source
      // of truth for the tally, so this branch must NOT increment `skipped`
      // (it would double-count if the SQL exclusion ever regressed). It only
      // skips: never failed (billed at submit → would show fail/undelivered
      // for a paid send) and never force-delivered with an unconfirmable
      // outcome.
      if (isBusinessApiRoute(msg.connection_type)) {
        continue;
      }

      // Supplier charging mode + timeout (optional)
      let supplierMode: ChargingMode | null = null;
      let supplierTimeout: number | null = null;
      if (msg.supplier_id) {
        try {
          const { rows: s } = await client.query(
            "SELECT charging_mode, force_dlr, dlr_timeout FROM suppliers WHERE id = $1",
            [msg.supplier_id]
          );
          if (s.length > 0) {
            supplierMode = resolveChargingMode(s[0]);
            supplierTimeout = parseInt(s[0].dlr_timeout as string || String(DEFAULT_TIMEOUT_SECONDS), 10) || DEFAULT_TIMEOUT_SECONDS;
          }
        } catch { /* keep null */ }
      }

      const decision = resolveStaleDlrAction({
        clientChargingMode: clientMode,
        supplierChargingMode: supplierMode,
        ageSeconds,
        clientTimeout,
        supplierTimeout,
      });
      if (!decision.due || decision.action === "skip") {
        skipped++;
        continue;
      }

      if (decision.action === "fail") {
        // on_dlr client: pending past window → FAILED / undelivered, no charge.
        const upd = await client.query(
          `UPDATE messages SET dlr_status = 'FAILED', status = 'FAILED', dlr_timestamp = NOW(),
           dlr_source = 'DLR_TIMEOUT'
           WHERE message_id = $1 AND dlr_status IN ('SENT', 'PENDING')`,
          [msg.message_id]
        );
        if (upd.rowCount === 0) { skipped++; continue; }
        await pushForcedDlr({
          msg, schemaName, tenantId, clientId: msg.client_id,
          status: "FAILED", smppStat: "UNDELIV", cost: 0, force: false,
          enqueueSMPP: clientIsSmpp,
        });
        resolved++;
        console.log(`[DLR-SWEEP] ${schemaName}: ${msg.message_id} FAILED (on_dlr pending > ${decision.windowSeconds}s) — fail/undelivered, no charge`);
        continue;
      }

      // deliver action (force_dlr_timeout on client or supplier)
      const clientForce = isForceDlr(clientMode) || isForceDlrTimeout(clientMode);
      const supplierForce = !!supplierMode && (isForceDlr(supplierMode) || isForceDlrTimeout(supplierMode));

      const existingCost = parseFloat(msg.cost || "0");
      const existingSuppCost = parseFloat(msg.supplier_cost || "0");

      let updateCost = existingCost;
      let updateSuppCost = existingSuppCost;

      // Client charged on timeout only when the client side is on_dlr
      if (isDlrCharged(clientMode) && existingCost === 0) {
        try {
          updateCost = await lookupClientRate(msg.destination, msg.client_id, schemaName, client);
        } catch { updateCost = existingCost; }
      }

      // Margin isolation: supplier is paid ONLY when supplier force mode is on
      if (supplierForce && existingSuppCost === 0 && msg.supplier_id) {
        try {
          updateSuppCost = await lookupSupplierCost(msg.destination, msg.supplier_id, schemaName, client);
        } catch { updateSuppCost = 0; }
      }

      const upd = await client.query(
        `UPDATE messages SET dlr_status = 'DELIVERED', status = 'DELIVERED', dlr_timestamp = NOW(),
         dlr_source = 'FORCE_TIMEOUT', cost = $2::numeric, supplier_cost = $3::numeric, profit = $2::numeric - $3::numeric
         WHERE message_id = $1 AND dlr_status IN ('SENT', 'PENDING')`,
        [msg.message_id, updateCost, updateSuppCost]
      );
      if (upd.rowCount === 0) { skipped++; continue; }

      // Charge on_dlr client's credit counter on the forced delivery.
      // try/finally guarantees the search_path is restored to the tenant schema
      // even if the counter update throws — otherwise the next loop iteration
      // would run against the public schema and abort the whole tenant sweep.
      if (isDlrCharged(clientMode)) {
        try {
          await client.query("SET search_path TO public");
          await client.query(
            "UPDATE tenants SET sms_counter = COALESCE(sms_counter, 0) + 1 WHERE id = $1",
            [tenantId]
          );
        } catch { /* best-effort */ }
        finally {
          await client.query(`SET search_path TO "${schemaName}"`).catch(() => {});
        }
      }

      await pushForcedDlr({
        msg, schemaName, tenantId, clientId: msg.client_id,
        status: "DELIVERED", smppStat: "DELIVRD", cost: updateCost, force: true,
        enqueueSMPP: clientIsSmpp,
      });
      resolved++;
      console.log(
        `[DLR-SWEEP] ${schemaName}: ${msg.message_id} force_timeout DELIVERED (pending > ${decision.windowSeconds}s), supplier_paid=${supplierForce}`
      );
    }

    await client.query("SET search_path TO public");
    return { resolved, skipped };
  } catch (err) {
    console.error(`[DLR-SWEEP] Tenant ${schemaName} sweep error:`, err);
    await client.query("SET search_path TO public").catch(() => {});
    return { resolved, skipped };
  } finally {
    client.release();
  }
}

/**
 * Sweep every active tenant schema.
 */
export async function sweepAllTenantStaleDlrs() {
  const pg = await pool.connect();
  let tenants: { id: number; schema_name: string }[] = [];
  try {
    const { rows } = await pg.query(
      "SELECT id, schema_name FROM tenants WHERE is_active = true"
    );
    tenants = rows as { id: number; schema_name: string }[];
  } catch (err) {
    console.error("[DLR-SWEEP] Main loop error:", err);
    pg.release();
    return;
  }
  pg.release();

  for (const t of tenants) {
    try {
      await sweepTenantStaleDlrs(t.id, t.schema_name);
    } catch (err) {
      console.error(`[DLR-SWEEP] Failed for tenant ${t.id} (${t.schema_name}):`, err);
    }
  }
}

let sweepInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the stale-DLR timeout sweeper.
 * Safe to call multiple times — only starts if not already running.
 */
export function startDlrTimeoutSweeper() {
  if (sweepInterval) return;
  console.log("[DLR-SWEEP] Starting stale DLR timeout sweeper (every 60s, window 300s default)");
  sweepInterval = setInterval(() => {
    sweepAllTenantStaleDlrs().catch((err) =>
      console.error("[DLR-SWEEP] Sweep cycle failed:", err)
    );
  }, SWEEP_INTERVAL_MS);
  // Run first sweep shortly after startup so DB is warm
  setTimeout(() => sweepAllTenantStaleDlrs().catch(() => {}), 10_000);
}

/**
 * Stop the sweeper (tests / shutdown).
 */
export function stopDlrTimeoutSweeper() {
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
  }
}
