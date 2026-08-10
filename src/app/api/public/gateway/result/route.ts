/**
 * POST /api/public/gateway/result
 *
 * A registered gateway reports the outcome of a polled MT message.
 *   success=true  → finished (message upgraded SENT → DELIVERED, DLR fired)
 *   success=false → requeued for retry (bounded); when attempts run out the
 *                   message is marked FAILED.
 */
import { pool } from "@/db";
import { reportRestMtResult } from "@/lib/gateway-rest-registry";
import { triggerDlrCallback } from "@/lib/smpp-client";
import {
  authenticateGatewayRequest,
  gatewayJson,
  gatewayOptions,
  withGatewayUsage,
} from "@/lib/gateway-rest-http";

const iso = (d: Date) => d.toISOString().replace(/T/, " ").replace(/\.\d{3}Z$/, "");

/**
 * Apply the terminal state to the message row. Returns the row's sender and
 * destination (used to build the DLR pushed back to the ESME client), or null.
 */
async function updateMessage(
  schemaName: string,
  messageId: string,
  kind: "sent" | "failed"
): Promise<{ sender: string; destination: string } | null> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    if (kind === "sent") {
      // Phone confirmed the SMS left the SIM — upgrade SENT → DELIVERED and
      // record the supplier-side id so the DLR fires to the ESME client.
      const { rows } = await client.query(
        `UPDATE messages SET status = 'DELIVERED', dlr_status = 'DELIVRD',
         supplier_message_id = COALESCE(supplier_message_id, message_id),
         dlr_timestamp = NOW()
         WHERE message_id = $1 AND status <> 'FAILED'
         RETURNING sender, destination`,
        [messageId]
      );
      return rows[0] ?? null;
    } else {
      const { rows } = await client.query(
        `UPDATE messages SET status = 'FAILED', dlr_status = 'FAILED',
         dlr_timestamp = NOW() WHERE message_id = $1 AND status <> 'DELIVERED'
         RETURNING sender, destination`,
        [messageId]
      );
      return rows[0] ?? null;
    }
  } catch (err) {
    console.error(`[GATEWAY-REST] result update (${kind}) error:`, err);
    return null;
  } finally {
    try {
      await client.query("SET search_path TO public");
    } catch {}
    client.release();
  }
}

export async function POST(request: Request) {
  const { auth, response, body = {} } = await authenticateGatewayRequest(request);
  if (response) return response;

  return withGatewayUsage(auth!, "/api/public/gateway/result", async () => {
    const messageId = String(body.messageId || "");
    if (!messageId) {
      return gatewayJson({ error: "messageId required" }, 400);
    }
    const success = body.success === true;

    const outcome = reportRestMtResult(
      auth!.tenantId,
      auth!.supplierId,
      messageId,
      success
    );

    if (outcome === "ok" || (success && outcome === "unknown")) {
      const row = await updateMessage(auth!.schemaName, messageId, "sent");

      // Fire the DLR callback registered at submit time so the ESME client
      // receives a real DELIVRD (REST gateways report over HTTPS instead of
      // SMPP DELIVER_SM, so the callback must be triggered explicitly).
      // triggerDlrCallback is one-shot — a retried POST cannot double-charge.
      if (success) {
        const now = iso(new Date());
        triggerDlrCallback(messageId, {
          messageId,
          supplierMessageId: messageId,
          status: "DELIVRD",
          submitDate: now,
          doneDate: now,
          errorCode: "000",
          dest: row?.destination ?? "",
          src: row?.sender ?? "",
        });
      }
    } else if (outcome === "dropped") {
      const row = await updateMessage(auth!.schemaName, messageId, "failed");
      // Fire the callback with FAILED so the client sees the terminal state.
      const now = iso(new Date());
      triggerDlrCallback(messageId, {
        messageId,
        supplierMessageId: messageId,
        status: "FAILED",
        submitDate: now,
        doneDate: now,
        errorCode: "999",
        dest: row?.destination ?? "",
        src: row?.sender ?? "",
      });
    }
    // "requeued" → nothing to update yet; "unknown" (not ours) → ignore

    return gatewayJson({ ok: true, outcome });
  });
}

export async function OPTIONS() {
  return gatewayOptions();
}
