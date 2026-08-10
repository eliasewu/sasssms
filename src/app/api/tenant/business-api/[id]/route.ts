import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

/**
 * PATCH /api/tenant/business-api/:id — update proxy assignment / active state.
 * DELETE /api/tenant/business-api/:id — remove a connection.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (body.proxyId !== undefined) {
    const pid = body.proxyId ? parseInt(String(body.proxyId), 10) : null;
    if (pid !== null && !Number.isFinite(pid)) {
      return NextResponse.json({ error: "proxyId must be a number or null" }, { status: 400 });
    }
    fields.push(`proxy_id = $${idx++}`);
    values.push(pid);
  }
  if (body.isActive !== undefined) {
    fields.push(`is_active = $${idx++}`);
    values.push(body.isActive === true || body.isActive === "true");
  }

  if (fields.length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  values.push(parseInt(id, 10));
  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE business_api_connect SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ api: result.rows[0] });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(_request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await tenantQuery(
    tenant.schemaName,
    "DELETE FROM business_api_connect WHERE id = $1 RETURNING id",
    [parseInt(id, 10)]
  );
  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
