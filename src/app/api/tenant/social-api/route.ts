import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM social_api_config ORDER BY id DESC");
  return NextResponse.json({ configs: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO social_api_config (platform, name, api_key, phone_number, webhook_url) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [body.platform, body.name, body.apiKey || null, body.phoneNumber || null, body.webhookUrl || null]
  );
  return NextResponse.json({ config: result.rows[0] }, { status: 201 });
}
