import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    FROM translation_profiles tp ORDER BY tp.id DESC`
  );

  return NextResponse.json({ profiles: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, targetField, mode, matchPattern, replacementFixed } = body;

  if (!name || !targetField || !mode) {
    return NextResponse.json({ error: "name, targetField, and mode are required" }, { status: 400 });
  }

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO translation_profiles (name, target_field, mode, match_pattern, replacement_fixed)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name, targetField, mode, matchPattern || ".*", replacementFixed || null]
  );

  return NextResponse.json({ profile: result.rows[0] }, { status: 201 });
}
