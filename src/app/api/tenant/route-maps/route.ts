import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM route_maps ORDER BY id DESC");
  return NextResponse.json({ maps: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO route_maps (name, description, rules) VALUES ($1,$2,$3) RETURNING *`,
    [body.name, body.description || null, body.rules || null]
  );
  return NextResponse.json({ map: result.rows[0] }, { status: 201 });
}
