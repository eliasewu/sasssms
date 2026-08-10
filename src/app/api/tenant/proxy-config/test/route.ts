import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { testProxyConnection } from "@/lib/proxy-connect";

export const dynamic = "force-dynamic";

/**
 * POST /api/tenant/proxy-config/test
 *
 * Runs a LIVE connectivity check through a saved proxy_config row: the server
 * connects to the proxy (SOCKS5/HTTP) and asks a public "what is my IP" service
 * through it, then reports the egress IP + latency.
 *
 * Body: { id: number }
 * Response: { ok, egressIp, latencyMs, error }
 */
export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const id = Number(body.id);
  if (!id) {
    return NextResponse.json({ error: "Proxy id required" }, { status: 400 });
  }

  // Include password here (list/GET deliberately omits it) so authenticated
  // proxies can be tested end-to-end.
  const result = await tenantQuery(
    tenant.schemaName,
    `SELECT id, name, host, port, protocol, username, password
     FROM proxy_config WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Proxy not found" }, { status: 404 });
  }
  const proxy = result.rows[0];

  const outcome = await testProxyConnection({
    host: proxy.host,
    port: proxy.port,
    protocol: proxy.protocol,
    username: proxy.username,
    password: proxy.password,
  });

  return NextResponse.json({
    ok: outcome.ok,
    egressIp: outcome.egressIp,
    latencyMs: outcome.latencyMs,
    error: outcome.error,
    proxyName: proxy.name,
  });
}
