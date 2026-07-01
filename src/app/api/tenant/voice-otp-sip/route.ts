import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM voice_otp_sip_config ORDER BY id DESC");
  return NextResponse.json({ configs: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO voice_otp_sip_config (name, sip_host, sip_port, sip_username, sip_password, caller_id, max_retries, timeout) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [body.name, body.sipHost || null, parseInt(body.sipPort) || 5060, body.sipUsername || null, body.sipPassword || null, body.callerId || null, parseInt(body.maxRetries) || 3, parseInt(body.timeout) || 30]
  );
  return NextResponse.json({ config: result.rows[0] }, { status: 201 });
}
