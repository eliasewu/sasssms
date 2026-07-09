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
  if (body.proxyType !== undefined) { fields.push(`proxy_type = $${idx++}`); values.push(body.proxyType); }
  if (body.host !== undefined) { fields.push(`host = $${idx++}`); values.push(body.host); }
  if (body.port !== undefined) { fields.push(`port = $${idx++}`); values.push(parseInt(body.port)); }
  if (body.username !== undefined) { fields.push(`username = $${idx++}`); values.push(body.username || null); }
  if (body.password !== undefined) { fields.push(`password = $${idx++}`); values.push(body.password || null); }
  if (body.protocol !== undefined) { fields.push(`protocol = $${idx++}`); values.push(body.protocol); }
  if (body.isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(body.isActive); }

  if (fields.length === 0) return NextResponse.json({ error: "No updatable fields" }, { status: 400 });

  values.push(id);
  const result = await tenantQuery(tenant.schemaName,
    `UPDATE proxy_config SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`, values);

  if (result.rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ config: result.rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await tenantQuery(tenant.schemaName, "DELETE FROM proxy_config WHERE id = $1", [id]);
  return NextResponse.json({ success: true });
}
