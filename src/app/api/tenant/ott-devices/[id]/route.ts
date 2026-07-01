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

  if (body.qrCode !== undefined) { fields.push(`qr_code = $${idx++}`); values.push(body.qrCode); }
  if (body.qrSession !== undefined) { fields.push(`qr_session = $${idx++}`); values.push(body.qrSession); }
  if (body.qrExpiresAt !== undefined) { fields.push(`qr_expires_at = $${idx++}`); values.push(body.qrExpiresAt); }
  if (body.status !== undefined) { fields.push(`status = $${idx++}`); values.push(body.status); }
  if (body.proxyId !== undefined) { fields.push(`proxy_id = $${idx++}`); values.push(body.proxyId); }

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
