/**
 * CUSTOM-API DLR Polling Worker
 *
 * Background job that polls DLR URLs for CUSTOM_API connector messages.
 * Runs every 5 seconds. For each pending CUSTOM_API message:
 *   1. Checks the connector's dlr_poll_seconds — skips if polled too recently
 *   2. Checks the connector's dlr_timeout_seconds — marks FAILED if exceeded
 *   3. Fetches the connector config
 *   4. Builds & hits the DLR URL with {{message_id}}
 *   5. Parses response (JSON or text/regex)
 *   6. Updates message dlr_status and last_dlr_poll_at in the database
 *   7. Pushes DLR to client webhook URL
 */
import { pool } from "@/db";
import {
  buildUrl,
  evaluateCondition,
  extractFromResponse,
  parseHeaders,
} from "@/lib/api-connector-parser";
import { lookupClientRate, lookupSupplierCost } from "@/lib/rates";

const POLL_INTERVAL_MS = 5_000; // 5 seconds — fast enough for 4s connectors

interface PendingMessage {
  id: number;
  message_id: string;
  supplier_message_id: string | null;
  destination: string;
  client_id: number;
  supplier_id: number;
  dlr_callback_url: string | null;
  created_at: string;
  last_dlr_poll_at: string | null;
}

const statusMap: Record<string, string> = {
  DELIVRD: "DELIVERED",
  DELIVERED: "DELIVERED",
  SENT: "DELIVERED",
  SUCCESS: "DELIVERED",
  SUCCESSFUL: "DELIVERED",
  EXPIRED: "FAILED",
  UNDELIV: "FAILED",
  UNDELIVERED: "FAILED",
  REJECTD: "FAILED",
  REJECTED: "FAILED",
  FAILED: "FAILED",
  FAIL: "FAILED",
  DELETED: "FAILED",
  UNKNOWN: "FAILED",
  ERROR: "FAILED",
  NOT_FOUND: "FAILED",
};

function normalizeDlrStatus(raw: string): string {
  return statusMap[raw.toUpperCase()] || "UNKNOWN";
}

async function pushDlrToClient(
  url: string,
  messageId: string,
  destination: string,
  status: string
) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_id: messageId,
        status,
        destination,
        timestamp: new Date().toISOString(),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch {
    // fire-and-forget
  }
}

/**
 * Poll DLR status for a single pending CUSTOM_API message.
 * Returns true if the DLR was resolved (delivered or failed), false if still pending.
 */
async function pollDlrForMessage(
  msg: PendingMessage,
  schemaName: string,
  tenantId: number,
  existingClient?: any
): Promise<boolean> {
  const client = existingClient || await pool.connect();
  const ownClient = !existingClient;
  try {
    if (ownClient) await client.query(`SET search_path TO "${schemaName}"`);

    // 1. Get supplier config → connector_id
    const suppResult = await client.query(
      "SELECT config FROM suppliers WHERE id = $1",
      [msg.supplier_id]
    );
    const rawConfig = suppResult.rows[0]?.config;
    const config =
      (typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig || {}) as Record<string, unknown>;
    const connectorId = config.custom_connector_id as number;
    if (!connectorId) return true; // no connector — mark as resolved (can't poll)

    // 2. Get connector DLR config (including poll settings)
    const connResult = await client.query(
      "SELECT * FROM custom_api_connectors WHERE id = $1 AND is_active = true",
      [connectorId]
    );
    if (connResult.rows.length === 0) return true;

    const conn = connResult.rows[0];

    // 3. Per-connector poll interval check — skip if polled too recently
    const pollSeconds =
      (conn.dlr_poll_seconds as number) || 30;
    if (msg.last_dlr_poll_at) {
      const elapsed =
        (Date.now() - new Date(msg.last_dlr_poll_at).getTime()) / 1000;
      if (elapsed < pollSeconds) return false; // not time to poll yet
    }

    // 4. Per-connector timeout check — mark FAILED if exceeded
    const timeoutSeconds =
      (conn.dlr_timeout_seconds as number) || 3600;
    const ageSeconds =
      (Date.now() - new Date(msg.created_at).getTime()) / 1000;
    if (ageSeconds > timeoutSeconds) {
      // DLR timed out — mark as FAILED
      await client.query(
        `UPDATE messages SET dlr_status = 'FAILED', dlr_timestamp = NOW(), last_dlr_poll_at = NOW()
         WHERE message_id = $1`,
        [msg.message_id]
      );
      if (msg.dlr_callback_url) {
        pushDlrToClient(
          msg.dlr_callback_url,
          msg.message_id,
          msg.destination,
          "FAILED"
        );
      }
      return true;
    }

    // 5. Skip if no DLR URL configured — mark as DELIVERED after timeout
    if (!conn.dlr_url_template) {
      // No DLR URL — mark as DELIVERED after the timeout window
      if (ageSeconds > timeoutSeconds) {
        await client.query(
          `UPDATE messages SET dlr_status = 'DELIVERED', dlr_timestamp = NOW(), last_dlr_poll_at = NOW()
           WHERE message_id = $1`,
          [msg.message_id]
        );
        if (msg.dlr_callback_url) {
          pushDlrToClient(
            msg.dlr_callback_url,
            msg.message_id,
            msg.destination,
            "DELIVERED"
          );
        }
        return true;
      }
      // Update last poll so we don't hammer the check
      await client.query(
        `UPDATE messages SET last_dlr_poll_at = NOW() WHERE message_id = $1`,
        [msg.message_id]
      );
      return false;
    }

    // 6. Build and call DLR URL
    const supplierMsgId =
      msg.supplier_message_id || msg.message_id;
    const url = buildUrl(conn.dlr_url_template as string, {
      message_id: supplierMsgId,
      dst: msg.destination,
      apiKey: "",
      sender: "",
      message: "",
    });

    const fetchOptions: RequestInit = {
      method: (conn.dlr_method as string) || "GET",
      headers: parseHeaders(conn.send_headers || ""),
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 15000); return c.signal; })(),
    };

    const res = await fetch(url, fetchOptions);
    const body = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(body);
      // Always inject raw body so text-based conditions ("body contains ...") work
      parsed.raw = body;
    } catch {
      parsed = { raw: body };
    }

    // 7. Update last poll timestamp regardless of result
    await client.query(
      `UPDATE messages SET last_dlr_poll_at = NOW() WHERE message_id = $1`,
      [msg.message_id]
    );

    // 8. Check DLR success condition
    const conditionMet = conn.dlr_success_condition
      ? evaluateCondition(conn.dlr_success_condition as string, parsed)
      : res.status === 200;

    if (!conditionMet) return false; // still pending

    // 9. Extract DLR status
    let rawStatus = "DELIVERED";
    if (conn.dlr_status_path) {
      const extracted = extractFromResponse(
        parsed,
        conn.dlr_status_path as string
      );
      rawStatus = String(extracted || conn.dlr_delivered_value || "DELIVERED");
    }

    // 10. Match against expected delivered value
    const deliveredValue =
      (conn.dlr_delivered_value as string) || "Delivered";
    const isDelivered =
      rawStatus.toUpperCase() === deliveredValue.toUpperCase();
    const dlrStatus = isDelivered
      ? "DELIVERED"
      : normalizeDlrStatus(rawStatus);

    // 11. Update message in DB
    // Only set costs on DELIVERED if message was DLR-billed (cost=0 on submit)
    let msgCost = 0;
    try {
      const { rows: costCheck } = await client.query(
        "SELECT cost FROM messages WHERE message_id = $1", [msg.message_id]
      );
      msgCost = costCheck.length > 0 ? parseFloat(costCheck[0].cost) : 0;
    } catch { /* keep 0 */ }
    const needsCostUpdate = dlrStatus === 'DELIVERED' && msg.client_id && msgCost === 0;

    if (needsCostUpdate) {
      try {
        const clientRate = await lookupClientRate(msg.destination, msg.client_id, schemaName, client);
        const suppCost = await lookupSupplierCost(msg.destination, msg.supplier_id, schemaName, client);
        const msgProfit = clientRate - suppCost;

        await client.query(
          `UPDATE messages SET dlr_status = $1, dlr_timestamp = NOW(),
           status = 'DELIVERED', cost = $4, supplier_cost = $5, profit = $6
           WHERE message_id = $3`,
          [dlrStatus, dlrStatus, msg.message_id, clientRate, suppCost, msgProfit]
        );
      } catch (err) {
        console.error(`[DLR-POLL] Rate lookup failed for ${msg.message_id}:`, err);
        // Fall back to zero-cost DELIVERED update
        await client.query(
          `UPDATE messages SET dlr_status = $1, dlr_timestamp = NOW(),
           status = 'DELIVERED' WHERE message_id = $3`,
          [dlrStatus, dlrStatus, msg.message_id]
        );
      }
    } else {
      await client.query(
        `UPDATE messages SET dlr_status = $1, dlr_timestamp = NOW(),
         status = CASE WHEN $2 = 'DELIVERED' THEN 'DELIVERED' ELSE status END
         WHERE message_id = $3`,
        [dlrStatus, dlrStatus, msg.message_id]
      );
    }

    // 11b. DLR-based billing: charge SMS credit ONLY for DLR-billed messages
    // (cost=0 on submit means it was deferred to delivery time)
    if (dlrStatus === "DELIVERED" && needsCostUpdate) {
      try {
        await client.query("SET search_path TO public");
        await client.query(
          "UPDATE tenants SET sms_counter = sms_counter + 1 WHERE id = $1",
          [tenantId]
        );
      } catch {
        // billing update is best-effort
      } finally {
        await client.query(`SET search_path TO "${schemaName}"`);
      }
    }

    // 12. Push DLR to client webhook
    if (msg.dlr_callback_url) {
      pushDlrToClient(
        msg.dlr_callback_url,
        msg.message_id,
        msg.destination,
        dlrStatus
      );
    }

    // DLR resolved if status is terminal
    return dlrStatus === "DELIVERED" || dlrStatus === "FAILED";
  } catch (err) {
    console.error(
      `[DLR-POLL] Error polling DLR for message ${msg.message_id}:`,
      err
    );
    return false;
  } finally {
    if (ownClient) {
      await client.query("SET search_path TO public");
      client.release();
    }
  }
}

/**
 * Main polling loop: fetches pending CUSTOM_API messages and polls their DLR URLs.
 */
export async function pollCustomApiDlrs() {
  const pgClient = await pool.connect();
  try {
    // Get all active tenant schemas with CUSTOM_API messages to poll
    const { rows: tenants } = await pgClient.query(
      "SELECT id, schema_name FROM tenants WHERE is_active = true"
    );

    for (const tenant of tenants) {
      try {
        await pgClient.query(`SET search_path TO "${tenant.schema_name}"`);

        const { rows: pending } = await pgClient.query(
          `SELECT m.id, m.message_id, m.supplier_message_id, m.destination,
                  m.client_id, m.supplier_id, m.dlr_callback_url, m.created_at, m.last_dlr_poll_at
           FROM messages m
           WHERE m.dlr_status = 'PENDING'
             AND m.connection_type = 'CUSTOM_API'
             AND m.created_at > NOW() - INTERVAL '2 hours'
           ORDER BY m.created_at ASC
           LIMIT 100`
        );

        for (const msg of pending) {
          const resolved = await pollDlrForMessage(
            msg as PendingMessage,
            tenant.schema_name,
            tenant.id,
            pgClient
          );
          if (resolved) {
            console.log(
              `[DLR-POLL] Resolved CUSTOM_API DLR for message ${msg.message_id} in tenant ${tenant.id}`
            );
          }
        }
      } catch {
        // Skip tenants with errors
      }
    }

    await pgClient.query("SET search_path TO public");
  } catch (err) {
    console.error("[DLR-POLL] Main loop error:", err);
  } finally {
    pgClient.release();
  }
}

let pollingInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the CUSTOM_API DLR polling worker.
 * Safe to call multiple times — only starts if not already running.
 */
export function startDlrPolling() {
  if (pollingInterval) return;
  console.log("[DLR-POLL] Starting CUSTOM_API DLR polling worker (every 5s)");
  pollingInterval = setInterval(pollCustomApiDlrs, POLL_INTERVAL_MS);
  // Run first poll immediately
  pollCustomApiDlrs().catch(() => {});
}

/**
 * Stop the DLR polling worker.
 */
export function stopDlrPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}
