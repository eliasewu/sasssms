import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM ott_devices ORDER BY id DESC");
  return NextResponse.json({ devices: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  
  // Validate proxy requirement
  if (!body.proxyId) {
    return NextResponse.json({ error: "Residential proxy is mandatory for OTT devices" }, { status: 400 });
  }

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO ott_devices (name, device_type, phone_number, api_config, proxy_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [body.name, body.deviceType, body.phoneNumber || null, body.apiConfig ? JSON.stringify(body.apiConfig) : null, parseInt(body.proxyId)]
  );
  return NextResponse.json({ device: result.rows[0] }, { status: 201 });
}
