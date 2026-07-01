import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const result = await tenantQuery(
    tenant.schemaName,
    `SELECT tp.*,
      COALESCE(
        (SELECT json_agg(json_build_object('id', tpi.id, 'replacementValue', tpi.replacement_value))
         FROM translation_pool_items tpi WHERE tpi.profile_id = tp.id), '[]'::json
      ) as pool_items,
      COALESCE(
        (SELECT json_agg(json_build_object('id', ta.id, 'clientId', ta.client_id, 'supplierId', ta.supplier_id, 'priority', ta.priority, 'isActive', ta.is_active))
         FROM translation_assignments ta WHERE ta.profile_id = tp.id), '[]'::json
      ) as assignments
    FROM translation_profiles tp WHERE tp.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  return NextResponse.json({ profile: result.rows[0] });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const sets: string[] = [];
  const vals: (string | number | boolean | null)[] = [];
  let idx = 1;

  if (body.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(body.name); }
  if (body.targetField !== undefined) { sets.push(`target_field = $${idx++}`); vals.push(body.targetField); }
  if (body.mode !== undefined) { sets.push(`mode = $${idx++}`); vals.push(body.mode); }
  if (body.matchPattern !== undefined) { sets.push(`match_pattern = $${idx++}`); vals.push(body.matchPattern); }
  if (body.replacementFixed !== undefined) { sets.push(`replacement_fixed = $${idx++}`); vals.push(body.replacementFixed); }
  if (body.isActive !== undefined) { sets.push(`is_active = $${idx++}`); vals.push(body.isActive); }

  if (sets.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE translation_profiles SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    [...vals, id]
  );

  return NextResponse.json({ profile: result.rows[0] });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  // Cascade delete pool items and assignments
  await tenantQuery(tenant.schemaName, "DELETE FROM translation_pool_items WHERE profile_id = $1", [id]);
  await tenantQuery(tenant.schemaName, "DELETE FROM translation_assignments WHERE profile_id = $1", [id]);
  await tenantQuery(tenant.schemaName, "DELETE FROM translation_profiles WHERE id = $1", [id]);

  return NextResponse.json({ success: true });
}
