/**
 * DLR Webhook Delivery Log — records every HTTP DLR push to an external
 * client so operators can verify webhooks were actually delivered.
 *
 * Used by every push path (voice-otp-dlr, smpp-client, dlr-poller, ott-worker)
 * so one dashboard can answer "was the DLR webhook delivered to the client?"
 *
 * Design:
 *  - `pushDlrWebhook` is the SINGLE shared fetch+capture+log implementation —
 *    all push sites call it, so logging can never be accidentally skipped.
 *  - Fire-and-forget: logging NEVER blocks or breaks the actual DLR push.
 *  - The table is auto-created per tenant schema on first use (guarded by a
 *    module-level Set), so existing tenants work without running a migration.
 *  - A periodic retention sweep (30 days) keeps the log table from growing
 *    without bound.
 */
import { pool } from "@/db";
import type { Pool, PoolClient } from "pg";

export interface DlrWebhookLogEntry {
  /** Platform message_id the DLR belongs to */
  messageId: string;
  /** DLR status that was pushed (DELIVERED / FAILED / ...) */
  status: string;
  /** Client's webhook URL that was called */
  pushedTo: string;
  /** HTTP status from the client's endpoint (null on network error) */
  httpStatus: number | null;
  /** Truncated response body from the client's endpoint */
  response: string;
  /** True when the client responded 2xx */
  success: boolean;
  /** Network/HTTP error message, when the push failed */
  error?: string;
}

const WEBHOOK_TIMEOUT_MS = 10_000;
const RESPONSE_TRUNCATE = 2000;
const RETENTION_DAYS = 30;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

// Cache schemas we've already ensured have the log table — avoids running
// CREATE TABLE on every single DLR push.
const ensuredSchemas = new Set<string>();

// Guard against duplicate retention intervals across Next.js entry points
const _g = globalThis as typeof globalThis & { __dlrWebhookLogCleanupStarted?: boolean };

async function ensureLogTable(
  pg: Pool | PoolClient,
  schemaName: string
): Promise<void> {
  if (ensuredSchemas.has(schemaName)) return;
  await pg.query(
    `CREATE TABLE IF NOT EXISTS "${schemaName}".dlr_webhook_logs (
      id SERIAL PRIMARY KEY,
      message_id VARCHAR(100),
      dlr_status VARCHAR(50),
      pushed_to TEXT,
      http_status INTEGER,
      response TEXT,
      success BOOLEAN DEFAULT false,
      error TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`
  );
  ensuredSchemas.add(schemaName);
  startWebhookLogCleanup();
}

/**
 * Periodically delete webhook log rows older than RETENTION_DAYS across all
 * active tenant schemas. Self-contained — no manual migration needed.
 */
function startWebhookLogCleanup(): void {
  if (_g.__dlrWebhookLogCleanupStarted) return;
  _g.__dlrWebhookLogCleanupStarted = true;
  setInterval(async () => {
    try {
      const { rows } = await pool.query(
        "SELECT schema_name FROM tenants WHERE is_active = true"
      );
      for (const t of rows) {
        try {
          await pool.query(
            `DELETE FROM "${t.schema_name}".dlr_webhook_logs
             WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS} days'`
          );
        } catch {
          // table may not exist yet — skip schema
        }
      }
    } catch {
      /* retention is best-effort */
    }
  }, CLEANUP_INTERVAL_MS);
}

/**
 * Record a DLR webhook delivery attempt (fire-and-forget).
 *
 * @param schemaName Tenant schema that owns the message
 * @param entry      Delivery details
 * @param pg         Optional Pool/PoolClient (the OTT worker passes its own pool)
 */
export async function logDlrWebhook(
  schemaName: string,
  entry: DlrWebhookLogEntry,
  pg?: Pool | PoolClient
): Promise<void> {
  try {
    const client = pg ?? pool;
    await ensureLogTable(client, schemaName);
    await client.query(
      `INSERT INTO "${schemaName}".dlr_webhook_logs
        (message_id, dlr_status, pushed_to, http_status, response, success, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.messageId || null,
        entry.status || null,
        entry.pushedTo || null,
        entry.httpStatus,
        (entry.response || "").slice(0, RESPONSE_TRUNCATE),
        entry.success,
        entry.error || null,
      ]
    );
  } catch (err) {
    // Logging must never break the DLR push — best effort only
    console.error(`[DLR-LOG] Failed to log webhook delivery for ${entry.messageId}:`, err);
  }
}

/**
 * Shared DLR webhook push: POSTs the payload to the client's URL with a
 * 10s timeout, captures the HTTP status + response body, records the
 * delivery attempt in the tenant's dlr_webhook_logs, and returns whether
 * the client responded 2xx.
 *
 * All DLR push sites must go through this helper so every push is logged.
 */
export async function pushDlrWebhook(
  url: string,
  payload: Record<string, unknown>,
  schemaName: string,
  messageId: string,
  status: string,
  pg?: Pool | PoolClient
): Promise<boolean> {
  let ok = false;
  let httpStatus: number | null = null;
  let response = "";
  let error: string | undefined;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    httpStatus = res.status;
    ok = res.ok;
    try {
      response = (await res.text()).slice(0, RESPONSE_TRUNCATE);
    } catch {
      /* response body optional */
    }
  } catch (err) {
    error = (err as Error).message;
  }

  await logDlrWebhook(
    schemaName,
    { messageId, status, pushedTo: url, httpStatus, response, success: ok, error },
    pg
  );

  return ok;
}
