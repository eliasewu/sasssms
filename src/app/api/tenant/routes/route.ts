import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await tenantQuery(
    tenant.schemaName,
    `SELECT r.*, t.name as trunk_name, t.supplier_id, s.name as supplier_name,
            COALESCE(
              (SELECT json_agg(json_build_object('trunk_id', rt.trunk_id, 'trunk_name', tt.name, 'supplier_name', ss.name, 'priority', rt.priority))
               FROM route_trunks rt
               JOIN trunks tt ON rt.trunk_id = tt.id AND tt.is_active = true
               LEFT JOIN suppliers ss ON tt.supplier_id = ss.id
               WHERE rt.route_id = r.id AND rt.is_active = true),
              '[]'::json
            ) as trunks
     FROM routes r 
     LEFT JOIN trunks t ON r.trunk_id = t.id 
     LEFT JOIN suppliers s ON t.supplier_id = s.id
     ORDER BY r.id DESC`
  );
  return NextResponse.json({ routes: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const { name, trunkId, countryCode, prefix, priority, trunkIds } = body;
  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO routes (name, trunk_id, country_code, prefix, priority) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, trunkId, countryCode || null, prefix || null, priority || 1]
  );
  const newRouteId = result.rows[0].id;

  // Insert multiple trunks via route_trunks junction if provided
  if (trunkIds && Array.isArray(trunkIds) && trunkIds.length > 0) {
    for (let i = 0; i < trunkIds.length; i++) {
      await tenantQuery(
        tenant.schemaName,
        `INSERT INTO route_trunks (route_id, trunk_id, priority) VALUES ($1, $2, $3)`,
        [newRouteId, trunkIds[i], i + 1]
      );
    }
  }

  revalidatePath('/dashboard/routes');
  return NextResponse.json({ route: result.rows[0] }, { status: 201 });
}
