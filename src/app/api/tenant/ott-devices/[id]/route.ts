import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (body.name !== undefined) { fields.push(`name = $${idx++}`); values.push(body.name); }
  if (body.deviceType !== undefined) { fields.push(`device_type = $${idx++}`); values.push(body.deviceType); }
  if (body.phoneNumber !== undefined) { fields.push(`phone_number = $${idx++}`); values.push(body.phoneNumber); }
  if (body.apiConfig !== undefined) {
    // Merge with existing api_config to preserve session data from prior pairing
    const existing = await tenantQuery(tenant.schemaName, "SELECT api_config FROM ott_devices WHERE id = $1", [id]);
    let existingCfg: Record<string, unknown> = {};
    if (existing.rows[0]?.api_config) {
      try { existingCfg = JSON.parse(existing.rows[0].api_config); } catch { /* keep empty */ }
    }
    const merged = { ...existingCfg, ...body.apiConfig };
    fields.push(`api_config = $${idx++}`); values.push(JSON.stringify(merged));
  }
  if (body.qrCode !== undefined) { fields.push(`qr_code = $${idx++}`); values.push(body.qrCode); }
  if (body.qrSession !== undefined) { fields.push(`qr_session = $${idx++}`); values.push(body.qrSession); }
  if (body.qrExpiresAt !== undefined) { fields.push(`qr_expires_at = $${idx++}`); values.push(body.qrExpiresAt); }
  if (body.status !== undefined) { fields.push(`status = $${idx++}`); values.push(body.status); }
  if (body.proxyId !== undefined) { fields.push(`proxy_id = $${idx++}`); values.push(body.proxyId ? parseInt(body.proxyId) : null); }
  if (body.isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(body.isActive); }

  if (fields.length === 0) return NextResponse.json({ error: "No fields" }, { status: 400 });

  values.push(id);
  const result = await tenantQuery(tenant.schemaName,
    `UPDATE ott_devices SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, values);

  if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ device: result.rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await tenantQuery(tenant.schemaName, "DELETE FROM ott_devices WHERE id = $1", [id]);
  return NextResponse.json({ success: true });
}
