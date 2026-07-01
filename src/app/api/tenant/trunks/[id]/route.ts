import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { name, supplierId, capacity, isActive } = body;

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE trunks SET name=$1, supplier_id=$2, capacity=$3, is_active=$4 WHERE id=$5 RETURNING *`,
    [name, supplierId, capacity, isActive, id]
  );

  return NextResponse.json({ trunk: result.rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await tenantQuery(tenant.schemaName, "DELETE FROM trunks WHERE id = $1", [id]);
  return NextResponse.json({ success: true });
}
