import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await tenantQuery(
    tenant.schemaName,
    `SELECT r.*, t.name as trunk_name, t.supplier_id, s.name as supplier_name
     FROM routes r 
     LEFT JOIN trunks t ON r.trunk_id = t.id 
     LEFT JOIN suppliers s ON t.supplier_id = s.id
     ORDER BY r.id DESC`
  );
  return NextResponse.json({ routes: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const { name, trunkId, countryCode, prefix, priority } = body;
  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO routes (name, trunk_id, country_code, prefix, priority) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, trunkId, countryCode || null, prefix || null, priority || 1]
  );
  return NextResponse.json({ route: result.rows[0] }, { status: 201 });
}
