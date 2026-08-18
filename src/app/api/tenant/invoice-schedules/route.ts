import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM invoice_schedules ORDER BY id");
  return NextResponse.json({ schedules: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO invoice_schedules
      (name, frequency, day_of_week, day_of_month, interval_days, scope, entity_id, period_days, is_active, next_run_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW()) RETURNING *`,
    [
      body.name || "Invoice Schedule",
      body.frequency || "weekly",
      parseInt(body.dayOfWeek ?? "1") || 1,
      parseInt(body.dayOfMonth ?? "1") || 1,
      body.intervalDays ?? null,
      body.scope || "all",
      body.entityId ?? null,
      parseInt(body.periodDays ?? "7") || 7,
      body.isActive !== false,
    ]
  );
  return NextResponse.json({ schedule: result.rows[0] }, { status: 201 });
}
