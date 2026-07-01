import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { softDelete, auditLog } from "@/lib/db-helpers";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const oldResult = await tenantQuery(tenant.schemaName, "SELECT * FROM routes WHERE id = $1", [id]);

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE routes SET name=$1, trunk_id=$2, country_code=$3, prefix=$4, priority=$5, is_active=$6, updated_at=NOW()
     WHERE id=$7 AND deleted_at IS NULL RETURNING *`,
    [body.name, body.trunkId, body.countryCode, body.prefix, body.priority, body.isActive, id]
  );

  await auditLog("routes", parseInt(id), "UPDATE", tenant.email, oldResult.rows[0] || {}, body, tenant.tenantId);
  return NextResponse.json({ route: result.rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const deleted = await softDelete(tenant.schemaName, "routes", parseInt(id), tenant.email, tenant.tenantId);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, message: "Route archived to CDR" });
}
