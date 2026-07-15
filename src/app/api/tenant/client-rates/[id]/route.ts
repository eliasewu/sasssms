import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { auditLog } from "@/lib/db-helpers";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  // Fetch old data for audit
  const oldResult = await tenantQuery(tenant.schemaName, "SELECT * FROM client_rates WHERE id = $1", [id]);
  const oldData = oldResult.rows[0] || null;

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE client_rates SET 
      client_id = COALESCE($1, client_id),
      country_code = COALESCE($2, country_code),
      mcc = COALESCE($3, mcc),
      mnc = COALESCE($4, mnc),
      operator_name = COALESCE($5, operator_name),
      rate = COALESCE($6, rate),
      is_active = COALESCE($7, is_active)
    WHERE id = $8 RETURNING *`,
    [
      body.clientId || null,
      body.countryCode || null,
      body.mcc || null,
      body.mnc || null,
      body.operatorName || null,
      body.rate || null,
      body.isActive !== undefined ? body.isActive : null,
      id,
    ]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Client rate not found" }, { status: 404 });
  }

  await auditLog("client_rates", parseInt(id), "UPDATE", tenant.email, oldData as Record<string, unknown> || undefined, result.rows[0] as Record<string, unknown>, tenant.tenantId);

  return NextResponse.json({ rate: result.rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Fetch old data before deleting (for audit log)
  const oldResult = await tenantQuery(tenant.schemaName, "SELECT * FROM client_rates WHERE id = $1", [id]);
  const oldData = oldResult.rows[0] || null;

  const result = await tenantQuery(
    tenant.schemaName,
    "DELETE FROM client_rates WHERE id = $1 RETURNING id",
    [id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Client rate not found" }, { status: 404 });
  }

  await auditLog("client_rates", parseInt(id), "DELETE", tenant.email, oldData as Record<string, unknown> || undefined, undefined, tenant.tenantId);

  return NextResponse.json({ success: true, message: "Client rate deleted" });
}
