/**
 * POST /api/public/gateway/poll
 *
 * Called every ~3s by a registered gateway. Dequeues up to `max` queued MT
 * messages and returns them. The gateway sends each via the SIM, then
 * reports the outcome to /api/public/gateway/result.
 */
import { dequeueRestMt } from "@/lib/gateway-rest-registry";
import {
  authenticateGatewayRequest,
  gatewayJson,
  gatewayOptions,
  withGatewayUsage,
} from "@/lib/gateway-rest-http";

export async function POST(request: Request) {
  const { auth, response, body = {} } = await authenticateGatewayRequest(request);
  if (response) return response;

  return withGatewayUsage(auth!, "/api/public/gateway/poll", async () => {
    const max = Math.min(Math.max(parseInt(String(body.max || "20"), 10) || 20, 1), 50);
    const items = dequeueRestMt(auth!.tenantId, auth!.supplierId, max);

    return gatewayJson({
      ok: true,
      messages: items.map((i) => ({
        messageId: i.messageId,
        source: i.source,
        destination: i.destination,
        content: i.content,
        attempts: i.attempts,
      })),
      pollIntervalMs: 3000,
    });
  });
}

export async function OPTIONS() {
  return gatewayOptions();
}
