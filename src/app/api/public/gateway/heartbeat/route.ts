/**
 * POST /api/public/gateway/heartbeat
 *
 * Called every ~15s by a registered gateway. Refreshes lastSeen in the REST
 * registry (and the supplier's last_bind_time) so the platform keeps it
 * online. If the gateway stops heartbeating, it is dropped after 90s and the
 * supplier falls back to UNBOUND.
 */
import { touchRestGateway } from "@/lib/gateway-rest-registry";
import { setSupplierOnline } from "@/lib/gateway-rest-auth";
import {
  authenticateGatewayRequest,
  gatewayJson,
  gatewayOptions,
  withGatewayUsage,
} from "@/lib/gateway-rest-http";

export async function POST(request: Request) {
  const { auth, response } = await authenticateGatewayRequest(request);
  if (response) return response;

  return withGatewayUsage(auth!, "/api/public/gateway/heartbeat", async () => {
    const touched = touchRestGateway(auth!.tenantId, auth!.supplierId);
    if (!touched) {
      // Not registered (server restarted?) — re-register implicitly so the
      // phone reconnects without a manual re-login.
      const { registerRestGateway } = await import("@/lib/gateway-rest-registry");
      registerRestGateway({
        tenantId: auth!.tenantId,
        schemaName: auth!.schemaName,
        supplierId: auth!.supplierId,
        username: auth!.username,
      });
    }
    await setSupplierOnline(auth!.schemaName, auth!.supplierId);

    return gatewayJson({ ok: true, supplierId: auth!.supplierId });
  });
}

export async function OPTIONS() {
  return gatewayOptions();
}
