import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const mcc = searchParams.get("mcc");
  const mnc = searchParams.get("mnc");
  const category = searchParams.get("category");

  let query = `SELECT tp.*, 
      COALESCE(
        (SELECT json_agg(json_build_object('id', tpi.id, 'replacementValue', tpi.replacement_value))
         FROM translation_pool_items tpi WHERE tpi.profile_id = tp.id), '[]'::json
      ) as pool_items,
      COALESCE(
        (SELECT json_agg(json_build_object('id', ta.id, 'clientId', ta.client_id, 'supplierId', ta.supplier_id, 'priority', ta.priority, 'isActive', ta.is_active))
         FROM translation_assignments ta WHERE ta.profile_id = tp.id AND ta.is_active = true), '[]'::json
      ) as assignments
    FROM translation_profiles tp WHERE 1=1`;
  const params: (string | null)[] = [];
  let idx = 1;

  if (mcc) { query += ` AND (tp.mcc = $${idx} OR tp.mcc IS NULL)`; params.push(mcc); idx++; }
  if (mnc) { query += ` AND (tp.mnc = $${idx} OR tp.mnc IS NULL)`; params.push(mnc); idx++; }
  if (category) { query += ` AND tp.category = $${idx}`; params.push(category); idx++; }
  query += ` ORDER BY tp.sort_order ASC, tp.id DESC`;

  const result = await tenantQuery(tenant.schemaName, query, params.length ? params : []);

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
    `INSERT INTO translation_profiles (name, target_field, mode, category, match_pattern, replacement_fixed, mcc, mnc)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [name, targetField, mode, body.category || 'SID', matchPattern || ".*", replacementFixed || null, body.mcc || null, body.mnc || null]
  );

  const profile = result.rows[0];

  // Create translation assignments based on scope + entity list (multi-select)
  const scope: string = body.scope || "both";
  const rawIds: number[] = Array.isArray(body.entityIds)
    ? body.entityIds.map((n: unknown) => parseInt(String(n), 10)).filter((n: number) => !isNaN(n))
    : body.entityId ? [parseInt(String(body.entityId), 10)] : [];

  const createdAssignments: unknown[] = [];
  if (scope === "both" || rawIds.length === 0) {
    // Global assignment (both NULL)
    const assignResult = await tenantQuery(
      tenant.schemaName,
      `INSERT INTO translation_assignments (profile_id, client_id, supplier_id, priority, is_active)
       VALUES ($1, NULL, NULL, $2, true) RETURNING *`,
      [profile.id, body.priority || 1]
    );
    createdAssignments.push(assignResult.rows[0]);
  } else {
    for (const eid of rawIds) {
      const assignResult = await tenantQuery(
        tenant.schemaName,
        `INSERT INTO translation_assignments (profile_id, client_id, supplier_id, priority, is_active)
         VALUES ($1, $2, $3, $4, true) RETURNING *`,
        [profile.id, scope === "client" ? eid : null, scope === "supplier" ? eid : null, body.priority || 1]
      );
      createdAssignments.push(assignResult.rows[0]);
    }
  }

  return NextResponse.json({
    profile,
    assignment: createdAssignments[0],
    assignments: createdAssignments,
    scope: rawIds.length === 0 ? "both" : scope,
  }, { status: 201 });
}
