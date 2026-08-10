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

  // Optional per-device send quotas (defaults: daily 250 / monthly 1000)
  const parsePositiveInt = (v: unknown, fallback: number) => {
    if (v === undefined || v === null || v === "") return fallback;
    const n = parseInt(String(v));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const dailyLimit = parsePositiveInt(body.dailyLimit, 250);
  const monthlyLimit = parsePositiveInt(body.monthlyLimit, 1000);

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO ott_devices (name, device_type, phone_number, api_config, proxy_id, daily_limit, monthly_limit)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      body.name,
      body.deviceType,
      body.phoneNumber || null,
      body.apiConfig ? JSON.stringify(body.apiConfig) : null,
      parseInt(body.proxyId),
      dailyLimit,
      monthlyLimit,
    ]
  );
  return NextResponse.json({ device: result.rows[0] }, { status: 201 });
}
