import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { name, type, apiUrl, apiKey, endpoints, isActive } = body;

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE connectors SET name=$1, type=$2, api_url=$3, api_key=$4, endpoints=$5, is_active=$6 WHERE id=$7 RETURNING *`,
    [name, type, apiUrl, apiKey, endpoints, isActive, id]
  );

  revalidatePath('/dashboard/connectors');
  return NextResponse.json({ connector: result.rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await tenantQuery(tenant.schemaName, "DELETE FROM connectors WHERE id = $1", [id]);
  revalidatePath('/dashboard/connectors');
  return NextResponse.json({ success: true });
}
