import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const entityType = url.searchParams.get("entityType");
  const entityId = url.searchParams.get("entityId");

  let query = "SELECT * FROM gateway_ips WHERE 1=1";
  const params: unknown[] = [];

  if (entityType) {
    params.push(entityType);
    query += ` AND entity_type = $${params.length}`;
  }
  if (entityId) {
    params.push(parseInt(entityId));
    query += ` AND entity_id = $${params.length}`;
  }

  query += " ORDER BY id ASC";

  const result = await tenantQuery(tenant.schemaName, query, params);
  return NextResponse.json({ gatewayIps: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();

  if (!body.entityType || !body.entityId || !body.ipAddress) {
    return NextResponse.json({ error: "Missing required fields: entityType, entityId, ipAddress" }, { status: 400 });
  }

  if (!["client", "supplier"].includes(body.entityType)) {
    return NextResponse.json({ error: "entityType must be 'client' or 'supplier'" }, { status: 400 });
  }

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO gateway_ips (entity_type, entity_id, ip_address, port, description, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      body.entityType,
      body.entityId,
      body.ipAddress,
      body.port || 2775,
      body.description || null,
      body.isActive !== false,
    ]
  );

  return NextResponse.json({ gatewayIp: result.rows[0] }, { status: 201 });
}

export async function DELETE(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  await tenantQuery(
    tenant.schemaName,
    "DELETE FROM gateway_ips WHERE id = $1",
    [parseInt(id)]
  );

  return NextResponse.json({ success: true });
}
