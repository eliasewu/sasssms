import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE invoice_schedules SET
       name=$1, frequency=$2, day_of_week=$3, day_of_month=$4, interval_days=$5,
       scope=$6, entity_id=$7, period_days=$8, is_active=$9
     WHERE id=$10 RETURNING *`,
    [
      body.name ?? "Invoice Schedule",
      body.frequency ?? "weekly",
      parseInt(body.dayOfWeek ?? "1") || 1,
      parseInt(body.dayOfMonth ?? "1") || 1,
      body.intervalDays ?? null,
      body.scope ?? "all",
      body.entityId ?? null,
      parseInt(body.periodDays ?? "7") || 7,
      body.isActive !== false,
      id,
    ]
  );
  return NextResponse.json({ schedule: result.rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await tenantQuery(tenant.schemaName, "DELETE FROM invoice_schedules WHERE id=$1", [id]);
  return NextResponse.json({ success: true });
}
