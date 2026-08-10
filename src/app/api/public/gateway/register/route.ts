/**
 * POST /api/public/gateway/register
 *
 * The Android/REST gateway registers itself over HTTP: sends its supplier
 * SMPP username + password (the same credentials used for SMPP bind), plus
 * device info. On success the supplier is marked online (BOUND) and the
 * phone may start polling /api/public/gateway/poll for MT messages.
 */
import { registerRestGateway } from "@/lib/gateway-rest-registry";
import { setSupplierOnline } from "@/lib/gateway-rest-auth";
import {
  authenticateGatewayRequest,
  gatewayJson,
  gatewayOptions,
  withGatewayUsage,
} from "@/lib/gateway-rest-http";

function cap(v: unknown, max: number): string | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).slice(0, max);
  return s || undefined;
}

export async function POST(request: Request) {
  const { auth, response, body = {} } = await authenticateGatewayRequest(request);
  if (response) return response;

  return withGatewayUsage(auth!, "/api/public/gateway/register", async () => {
    registerRestGateway({
      tenantId: auth!.tenantId,
      schemaName: auth!.schemaName,
      supplierId: auth!.supplierId,
      username: auth!.username,
      deviceInfo: cap(body.deviceInfo, 500),
      serverIp: cap(body.serverIp, 64),
    });
    await setSupplierOnline(auth!.schemaName, auth!.supplierId);

    console.log(
      `[GATEWAY-REST] ✅ Registered supplier #${auth!.supplierId} (tenant ${auth!.tenantId}, ${auth!.schemaName}) via HTTP`
    );

    return gatewayJson({
      ok: true,
      supplierId: auth!.supplierId,
      tenantId: auth!.tenantId,
      pollIntervalMs: 3000,
      heartbeatIntervalMs: 15000,
    });
  });
}

export async function OPTIONS() {
  return gatewayOptions();
}
