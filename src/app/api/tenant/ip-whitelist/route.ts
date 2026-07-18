import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM ip_whitelist ORDER BY id DESC");
  return NextResponse.json({ ips: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO ip_whitelist (ip_address, description) VALUES ($1,$2) RETURNING *`,
    [body.ipAddress, body.description || null]
  );
  revalidatePath('/dashboard/ip-list');
  return NextResponse.json({ ip: result.rows[0] }, { status: 201 });
}
