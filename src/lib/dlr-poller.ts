/**
 * CUSTOM-API DLR Polling Worker
 *
 * Background job that polls DLR URLs for CUSTOM_API connector messages.
 * Runs every 30 seconds. For each pending CUSTOM_API message:
 *   1. Fetches the connector config
 *   2. Builds & hits the DLR URL with {{message_id}}
 *   3. Parses response (JSON or text/regex)
 *   4. Updates message dlr_status in the database
 *   5. Pushes DLR to client webhook URL
 */
import { pool } from "@/db";
import {
  buildUrl,
  evaluateCondition,
  extractFromResponse,
  parseHeaders,
} from "@/lib/api-connector-parser";

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const MAX_AGE_MS = 3_600_000; // 1 hour — stop polling for messages older than this

interface PendingMessage {
  id: number;
  message_id: string;
  supplier_message_id: string | null;
  destination: string;
  supplier_id: number;
  dlr_callback_url: string | null;
  created_at: string;
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
    const config =
      (suppResult.rows[0]?.config as Record<string, unknown>) || {};
    const connectorId = config.custom_connector_id as number;
    if (!connectorId) return true; // no connector — mark as resolved (can't poll)

    // 2. Get connector DLR config
    const connResult = await client.query(
      "SELECT * FROM custom_api_connectors WHERE id = $1 AND is_active = true",
      [connectorId]
    );
    if (connResult.rows.length === 0) return true;

    const conn = connResult.rows[0];

    // 3. Skip if no DLR URL configured
    if (!conn.dlr_url_template) {
      // No DLR URL — mark as DELIVERED after 5 minutes (optimistic)
      const age = Date.now() - new Date(msg.created_at).getTime();
      if (age > 300_000) {
        await client.query(
          `UPDATE messages SET dlr_status = 'DELIVERED', dlr_timestamp = NOW()
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
      return false; // still pending, keep polling
    }

    // 4. Build and call DLR URL
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
      headers: parseHeaders(conn.dlr_send_headers || conn.send_headers || ""),
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 15000); return c.signal; })(),
    };

    const res = await fetch(url, fetchOptions);
    const body = await res.text();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = { raw: body };
    }

    // 5. Check DLR success condition
    const conditionMet = conn.dlr_success_condition
      ? evaluateCondition(conn.dlr_success_condition as string, parsed)
      : res.status === 200;

    if (!conditionMet) return false; // still pending

    // 6. Extract DLR status
    let rawStatus = "DELIVERED";
    if (conn.dlr_status_path) {
      const extracted = extractFromResponse(
        parsed,
        conn.dlr_status_path as string
      );
      rawStatus = String(extracted || conn.dlr_delivered_value || "DELIVERED");
    }

    // 7. Match against expected delivered value
    const deliveredValue =
      (conn.dlr_delivered_value as string) || "DELIVERED";
    const isDelivered =
      rawStatus.toUpperCase() === deliveredValue.toUpperCase();
    const dlrStatus = isDelivered
      ? "DELIVERED"
      : normalizeDlrStatus(rawStatus);

    // 8. Update message in DB
    await client.query(
      `UPDATE messages SET dlr_status = $1, dlr_timestamp = NOW(),
       status = CASE WHEN $1 = 'DELIVERED' THEN 'DELIVERED' ELSE status END
       WHERE message_id = $2`,
      [dlrStatus, msg.message_id]
    );

    // 9. Push DLR to client webhook
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
                  m.supplier_id, m.dlr_callback_url, m.created_at
           FROM messages m
           WHERE m.dlr_status = 'PENDING'
             AND m.connection_type = 'CUSTOM_API'
             AND m.created_at > NOW() - INTERVAL '1 hour'
           ORDER BY m.created_at ASC
           LIMIT 50`
        );

        for (const msg of pending) {            const resolved = await pollDlrForMessage(
              msg as PendingMessage,
              tenant.schema_name,
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
  console.log("[DLR-POLL] Starting CUSTOM_API DLR polling worker (every 30s)");
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
