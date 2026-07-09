import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT id, name, proxy_type, host, port, username, protocol, is_active, created_at FROM proxy_config ORDER BY id DESC");
  return NextResponse.json({ configs: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO proxy_config (name, proxy_type, host, port, username, password, protocol) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [body.name, body.proxyType || "residential", body.host, parseInt(body.port), body.username || null, body.password || null, body.protocol || "socks5"]
  );
  return NextResponse.json({ config: result.rows[0] }, { status: 201 });
}
