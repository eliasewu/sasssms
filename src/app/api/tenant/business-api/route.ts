import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM business_api_connect ORDER BY id DESC");
  return NextResponse.json({ apis: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO business_api_connect (name, provider, api_url, credentials) VALUES ($1,$2,$3,$4) RETURNING *`,
    [body.name, body.provider, body.apiUrl || null, body.credentials || null]
  );
  return NextResponse.json({ api: result.rows[0] }, { status: 201 });
}
