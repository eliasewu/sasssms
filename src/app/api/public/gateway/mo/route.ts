/**
 * POST /api/public/gateway/mo
 *
 * A registered gateway reports an incoming SMS (MO) it received on the SIM.
 * Stored in the tenant's sms_inbox with the supplier id — identical to the
 * SMPP submit_sm MO path.
 */
import { pool } from "@/db";
import { isMmsForwardEnabled, isMmsPlaceholder } from "@/lib/mms-forward";
import {
  authenticateGatewayRequest,
  gatewayJson,
  gatewayOptions,
  withGatewayUsage,
} from "@/lib/gateway-rest-http";

export async function POST(request: Request) {
  const { auth, response, body = {} } = await authenticateGatewayRequest(request);
  if (response) return response;

  return withGatewayUsage(auth!, "/api/public/gateway/mo", async () => {
    const sender = String(body.sender || "").slice(0, 30);
    const destination = String(body.destination || "").slice(0, 30);
    const content = String(body.content || "").slice(0, 1600);
    if (!sender || !content) {
      return gatewayJson({ error: "sender and content required" }, 400);
    }

    // Per-tenant MMS-forwarding setting: [MMS] placeholder MOs (WAP_PUSH MMS
    // notifications forwarded by the gateway) are dropped when the tenant
    // disabled forwarding. Acknowledge success so the phone never retries.
    if (isMmsPlaceholder(content)) {
      const enabled = await isMmsForwardEnabled(auth!.tenantId);
      if (!enabled) {
        console.log(
          `[GATEWAY-REST] Dropped [MMS] MO from ${sender} (MMS forwarding disabled for tenant ${auth!.tenantId})`
        );
        return gatewayJson({ ok: true, dropped: "mms_forward_disabled" });
      }
    }

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO "${auth!.schemaName}"`);
      await client.query(
        `INSERT INTO sms_inbox (sender, destination, content, supplier_id)
         VALUES ($1, $2, $3, $4)`,
        [sender, destination, content, auth!.supplierId]
      );
      console.log(
        `[GATEWAY-REST] MO from ${sender} → ${destination} via supplier #${auth!.supplierId}: ${content.substring(0, 40)}`
      );
    } catch (err) {
      console.error("[GATEWAY-REST] MO insert error:", err);
      return gatewayJson({ error: "Storage failed" }, 500);
    } finally {
      try {
        await client.query("SET search_path TO public");
      } catch {}
      client.release();
    }

    return gatewayJson({ ok: true });
  });
}

export async function OPTIONS() {
  return gatewayOptions();
}
