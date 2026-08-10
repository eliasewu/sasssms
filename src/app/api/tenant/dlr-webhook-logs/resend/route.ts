/**
 * POST /api/tenant/dlr-webhook-logs/resend
 *
 * Manually re-push a DLR webhook for a specific message — used to debug
 * client integrations (e.g. re-deliver a webhook after fixing the client
 * endpoint, or inspect the exact payload/response).
 *
 * Body: { messageId }
 *
 * The re-push goes through pushDlrWebhook, so the attempt is recorded in the
 * tenant's dlr_webhook_logs table like any normal delivery, and the latest
 * log entry (HTTP status + response body) is returned for immediate feedback.
 */
import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { pushDlrWebhook } from "@/lib/dlr-webhook-log";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const messageId = String((body as Record<string, unknown>).messageId || "").trim();
  if (!messageId) {
    return NextResponse.json({ error: "messageId required" }, { status: 400 });
  }

  // Look up the message + the client's current webhook URL (fall back to the
  // URL captured on the message row so historical messages still resend).
  const result = await tenantQuery(
    tenant.schemaName,
    `SELECT m.*, c.dlr_callback_url as client_callback, c.webhook_url as client_webhook,
            r.name as route_name, s.name as supplier_name
     FROM messages m
     LEFT JOIN clients c ON m.client_id = c.id
     LEFT JOIN routes r ON m.route_id = r.id
     LEFT JOIN suppliers s ON m.supplier_id = s.id
     WHERE m.message_id = $1`,
    [messageId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const msg = result.rows[0] as Record<string, unknown>;
  const callbackUrl = String(
    msg.dlr_callback_url || msg.client_callback || msg.client_webhook || ""
  ).trim();

  if (!callbackUrl) {
    return NextResponse.json(
      { error: "No DLR webhook URL configured for this message's client" },
      { status: 400 }
    );
  }

  // Re-push the message's latest known DLR status — optionally overridden by
  // the caller (e.g. re-push a FAILED message as DELIVERED to test the
  // client's happy path).
  const requestedStatus = String((body as Record<string, unknown>).status || "").trim();
  const status = requestedStatus || String(msg.dlr_status || "SENT");
  const payload = {
    message_id: messageId,
    supplier_message_id: msg.supplier_message_id || null,
    status,
    dlr_status: status,
    destination: msg.destination,
    source: msg.sender,
    cost: msg.cost ? parseFloat(String(msg.cost)) : 0,
    route_name: msg.route_name || null,
    supplier_name: msg.supplier_name || null,
    timestamp: new Date().toISOString(),
    resend: true, // marks a manual re-push vs. an automatic delivery
  };

  const ok = await pushDlrWebhook(
    callbackUrl,
    payload,
    tenant.schemaName,
    messageId,
    status
  );

  // Return the freshly logged delivery attempt so the caller sees the HTTP
  // status and response body immediately.
  let log = null;
  try {
    const logResult = await tenantQuery(
      tenant.schemaName,
      `SELECT id, message_id, dlr_status, pushed_to, http_status, response, success, error, created_at
       FROM dlr_webhook_logs WHERE message_id = $1 ORDER BY id DESC LIMIT 1`,
      [messageId]
    );
    log = logResult.rows[0] || null;
  } catch {
    /* log table may not exist yet — non-critical */
  }

  return NextResponse.json({
    ok,
    messageId,
    pushed_to: callbackUrl,
    status,
    log,
  });
}
