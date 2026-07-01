import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { auditLog } from "@/lib/db-helpers";

// Bind or unbind a client or supplier
export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { entityType, entityId, action } = body; // entityType: "clients" | "suppliers", action: "BIND" | "UNBIND"

  if (!entityType || !entityId || !action) {
    return NextResponse.json({ error: "entityType, entityId, action required" }, { status: 400 });
  }

  const table = entityType === "clients" ? "clients" : "suppliers";
  const newStatus = action === "BIND" ? "BOUND" : "UNBOUND";

  // Get current entity
  const oldResult = await tenantQuery(tenant.schemaName, `SELECT * FROM ${table} WHERE id = $1`, [entityId]);
  if (oldResult.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entity = oldResult.rows[0];

  // Update bind status
  await tenantQuery(
    tenant.schemaName,
    `UPDATE ${table} SET bind_status = $1, last_bind_time = CASE WHEN $2 = 'BIND' THEN NOW() ELSE last_bind_time END, updated_at = NOW()
     WHERE id = $3`,
    [newStatus, action, entityId]
  );

  // Audit log
  await auditLog(
    table, entityId, action === "BIND" ? "BIND" : "UNBIND",
    tenant.email, { bind_status: entity.bind_status }, { bind_status: newStatus }, tenant.tenantId
  );

  return NextResponse.json({
    success: true,
    entity: { id: entityId, name: entity.name || entity.supplier_code, bindStatus: newStatus },
    message: `${entity.name || entity.supplier_code} ${action === "BIND" ? "bound" : "unbound"} successfully`,
  });
}
