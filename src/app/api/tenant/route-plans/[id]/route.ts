import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { name, description, isActive, routeIds } = body;

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE route_plans SET name=$1, description=$2, is_active=$3 WHERE id=$4 RETURNING *`,
    [name, description, isActive, id]
  );

  // Update routes
  if (routeIds && Array.isArray(routeIds)) {
    await tenantQuery(tenant.schemaName, `DELETE FROM route_plan_routes WHERE route_plan_id = $1`, [id]);
    for (let i = 0; i < routeIds.length; i++) {
      await tenantQuery(
        tenant.schemaName,
        `INSERT INTO route_plan_routes (route_plan_id, route_id, priority) VALUES ($1, $2, $3)`,
        [id, routeIds[i], i + 1]
      );
    }
  }

  return NextResponse.json({ routePlan: result.rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await tenantQuery(tenant.schemaName, "DELETE FROM route_plan_routes WHERE route_plan_id = $1", [id]);
  await tenantQuery(tenant.schemaName, "DELETE FROM route_plans WHERE id = $1", [id]);
  return NextResponse.json({ success: true });
}
