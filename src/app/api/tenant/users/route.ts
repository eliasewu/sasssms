import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getTenantFromRequest, hashPassword } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT id, name, email, role_id, is_active, last_login, created_at FROM users ORDER BY id DESC");
  return NextResponse.json({ users: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const passwordHash = await hashPassword(body.password);
  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO users (name, email, password_hash, role_id) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role_id`,
    [body.name, body.email, passwordHash, body.roleId || null]
  );
  revalidatePath('/dashboard/users');
  return NextResponse.json({ user: result.rows[0] }, { status: 201 });
}
