import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM connectors ORDER BY id DESC");
  return NextResponse.json({ connectors: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, type, apiUrl, apiKey, endpoints } = body;

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO connectors (name, type, api_url, api_key, endpoints) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, type, apiUrl || null, apiKey || null, endpoints || null]
  );

  return NextResponse.json({ connector: result.rows[0] }, { status: 201 });
}
