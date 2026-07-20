import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
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
    [body.name ?? '', body.trunkId ?? null, body.countryCode ?? null, body.prefix ?? null, body.priority ?? 1, body.isActive ?? true, id]
  );

  // Update multiple trunks via route_trunks junction
  if (body.trunkIds !== undefined) {
    // Delete existing route_trunks entries and re-insert
    await tenantQuery(tenant.schemaName, `DELETE FROM route_trunks WHERE route_id = $1`, [id]);
    if (Array.isArray(body.trunkIds) && body.trunkIds.length > 0) {
      for (let i = 0; i < body.trunkIds.length; i++) {
        await tenantQuery(
          tenant.schemaName,
          `INSERT INTO route_trunks (route_id, trunk_id, priority) VALUES ($1, $2, $3)`,
          [id, body.trunkIds[i], i + 1]
        );
      }
    }
  }

  await auditLog("routes", parseInt(id), "UPDATE", tenant.email, oldResult.rows[0] || {}, body, tenant.tenantId);
  revalidatePath('/dashboard/routes');
  return NextResponse.json({ route: result.rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const deleted = await softDelete(tenant.schemaName, "routes", parseInt(id), tenant.email, tenant.tenantId);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  revalidatePath('/dashboard/routes');
  return NextResponse.json({ success: true, message: "Route archived to CDR" });
}
