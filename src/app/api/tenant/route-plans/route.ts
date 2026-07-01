import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await tenantQuery(
    tenant.schemaName,
    `SELECT rp.*, 
     COALESCE(json_agg(json_build_object(
       'route_id', rpr.route_id, 'priority', rpr.priority, 
       'route_name', r.name, 'trunk_name', t.name, 'supplier_name', s.name
     )) FILTER (WHERE rpr.id IS NOT NULL), '[]') as routes
     FROM route_plans rp
     LEFT JOIN route_plan_routes rpr ON rp.id = rpr.route_plan_id
     LEFT JOIN routes r ON rpr.route_id = r.id
     LEFT JOIN trunks t ON r.trunk_id = t.id
     LEFT JOIN suppliers s ON t.supplier_id = s.id
     GROUP BY rp.id ORDER BY rp.id DESC`
  );
  return NextResponse.json({ routePlans: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const { name, description, routeIds } = body;

  const planResult = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO route_plans (name, description) VALUES ($1, $2) RETURNING *`,
    [name, description || null]
  );
  const plan = planResult.rows[0];

  if (routeIds && Array.isArray(routeIds)) {
    for (let i = 0; i < routeIds.length; i++) {
      await tenantQuery(
        tenant.schemaName,
        `INSERT INTO route_plan_routes (route_plan_id, route_id, priority) VALUES ($1, $2, $3)`,
        [plan.id, routeIds[i], i + 1]
      );
    }
  }

  return NextResponse.json({ routePlan: plan }, { status: 201 });
}
