import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { auditLog } from "@/lib/db-helpers";
import { recordRateChange } from "@/lib/billing-service";

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

  const updated = result.rows[0];
  if (oldData && oldData.rate !== updated.rate) {
    await recordRateChange(tenant.schemaName, "client", updated.client_id, {
      rateId: updated.id,
      oldRateId: null,
      countryCode: updated.country_code,
      mcc: updated.mcc,
      mnc: updated.mnc,
      operatorName: updated.operator_name,
      oldRate: oldData.rate != null ? String(oldData.rate) : null,
      newRate: String(updated.rate),
      action: "UPDATE",
      changedBy: tenant.email,
    });
  }

  return NextResponse.json({ rate: result.rows[0] });
}

export async function DELETE() {
  return NextResponse.json({ error: "Rates cannot be deleted. Use Edit to modify or toggle Active/Inactive instead." }, { status: 405 });
}
