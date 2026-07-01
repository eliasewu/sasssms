import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM campaigns ORDER BY id DESC");
  return NextResponse.json({ campaigns: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const recipients = body.recipients?.split(/[\n,]/).map((r: string) => r.trim()).filter(Boolean) || [];
  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO campaigns (name, client_id, sender, content, recipients, total_count, status) VALUES ($1,$2,$3,$4,$5,$6,'DRAFT') RETURNING *`,
    [body.name, body.clientId || 1, body.sender, body.content, JSON.stringify(recipients), recipients.length]
  );
  return NextResponse.json({ campaign: result.rows[0] }, { status: 201 });
}
