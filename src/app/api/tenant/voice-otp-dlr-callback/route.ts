import { NextResponse } from "next/server";
import { pool } from "@/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/tenant/voice-otp-dlr-callback
 *
 * Receives DLR callbacks from external voice OTP providers.
 * They POST/GET to the dlr_url we send in the API payload.
 *
 * Query params:
 *   ?message_id=MSG_xxx&supplier_id=N&tenant_id=N&schema=tenant_X&status=DELIVERED
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const messageId = url.searchParams.get("message_id");
  const supplierId = url.searchParams.get("supplier_id");
  const tenantId = url.searchParams.get("tenant_id");
  const schema = url.searchParams.get("schema");
  const status = url.searchParams.get("status") || "DELIVERED";

  if (!messageId) {
    return NextResponse.json({ error: "message_id required" }, { status: 400 });
  }

  console.log(`[VOICE-OTP-DLR] DLR received: ${messageId} → ${status}`);

  if (schema) {
    // Validate schema name to prevent SQL injection (same regex used in tenant-schema.ts)
    if (!/^[a-z0-9_]+$/.test(schema)) {
      console.warn(`[VOICE-OTP-DLR] Invalid schema name rejected: ${schema}`);
      return NextResponse.json({ error: "Invalid schema" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${schema}"`);

      // Map DLR status to our internal status
      const statusMap: Record<string, string> = {
        DELIVERED: "DELIVERED",
        ANSWERED: "DELIVERED",
        COMPLETED: "DELIVERED",
        FAILED: "FAILED",
        NO_ANSWER: "FAILED",
        BUSY: "FAILED",
        REJECTED: "FAILED",
      };
      const dlrStatus = statusMap[status.toUpperCase()] || status;

      await client.query(
        `UPDATE messages SET dlr_status = $1, dlr_timestamp = NOW(), status = $2 WHERE message_id = $3`,
        [dlrStatus, dlrStatus, messageId]
      );

      // Update call log by call_sid or message_id (not by destination — avoids cross-updating)
      const callLogResult = await client.query(
        `UPDATE voice_otp_call_logs SET status = $1
         WHERE call_sid = $2
         RETURNING id`,
        [dlrStatus === "DELIVERED" ? "COMPLETED" : "FAILED", messageId]
      );

      if (callLogResult.rows.length === 0) {
        // Fallback: try matching by the message's destination within the same time window
        await client.query(
          `UPDATE voice_otp_call_logs SET status = $1
           WHERE destination = (SELECT destination FROM messages WHERE message_id = $2 LIMIT 1)
             AND created_at > NOW() - INTERVAL '10 minutes'
             AND status = 'IN_PROGRESS'
           RETURNING id`,
          [dlrStatus === "DELIVERED" ? "COMPLETED" : "FAILED", messageId]
        );
      }

      // Calculate profit for delivered messages
      if (dlrStatus === "DELIVERED") {
        await client.query(
          `UPDATE messages SET 
            supplier_cost = COALESCE(supplier_cost, 0),
            profit = COALESCE(cost, 0) - COALESCE(supplier_cost, 0)
           WHERE message_id = $1 AND supplier_cost IS NOT NULL AND profit IS NULL`,
          [messageId]
        );
      }

      await client.query(`SET search_path TO public`);
    } catch (err) {
      console.error(`[VOICE-OTP-DLR] DB error:`, err);
    } finally {
      client.release();
    }
  }

  return NextResponse.json({ received: true, message_id: messageId });
}

/**
 * Also accept POST for providers that POST their callbacks
 */
export async function POST(request: Request) {
  // Handle both JSON body and query params
  const url = new URL(request.url);
  let messageId = url.searchParams.get("message_id");
  let status = url.searchParams.get("status");

  // Also try JSON body
  if (!messageId || !status) {
    try {
      const body = await request.json();
      messageId = messageId || body.message_id || body.messageId;
      status = status || body.status;
    } catch { /* use query params only */ }
  }

  if (messageId) {
    // Forward to GET handler
    const queryUrl = new URL(request.url);
    queryUrl.searchParams.set("message_id", messageId);
    if (status) queryUrl.searchParams.set("status", status);
    return GET(new Request(queryUrl.toString()));
  }

  return NextResponse.json({ error: "message_id required" }, { status: 400 });
}
