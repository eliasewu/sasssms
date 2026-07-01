import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // Body: { assignments: [{ clientId?: number, supplierId?: number, priority?: number }] }
  const assignments = body.assignments || [];

  // Remove existing assignments
  await tenantQuery(tenant.schemaName, "DELETE FROM translation_assignments WHERE profile_id = $1", [id]);

  // Insert new assignments
  const created: Record<string, unknown>[] = [];
  for (const a of assignments) {
    if (!a.clientId && !a.supplierId) continue;
    const result = await tenantQuery(
      tenant.schemaName,
      `INSERT INTO translation_assignments (profile_id, client_id, supplier_id, priority, is_active)
       VALUES ($1, $2, $3, $4, true) RETURNING *`,
      [id, a.clientId || null, a.supplierId || null, a.priority || 1]
    );
    created.push(result.rows[0]);
  }

  return NextResponse.json({ assignments: created });
}
