import { NextResponse } from "next/server";
import { getSuperAdminFromRequest, createImpersonationToken } from "@/lib/auth";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auditLog } from "@/lib/db-helpers";

/**
 * Super-admin tenant impersonation ("access link").
 *
 * A logged-in super admin can access any tenant's dashboard without knowing
 * the tenant's password. This mints a short-lived (15 min) tenant_token for
 * the target tenant and drops it into a cookie — the same cookie the normal
 * login flow sets — so the existing /dashboard layout and every tenant API
 * route work unchanged. The super_admin_token cookie is left intact, so the
 * admin's own session is preserved for when they navigate back to /super.
 */
export async function POST(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized — super admin session required" }, { status: 401 });
  }

  let tenantId: number;
  try {
    const body = await request.json();
    tenantId = Number(body.tenantId);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    return NextResponse.json({ error: "A valid tenantId is required" }, { status: 400 });
  }

  const [tenant] = await db
    .select({
      id: tenants.id,
      email: tenants.email,
      schemaName: tenants.schemaName,
      companyName: tenants.companyName,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const token = createImpersonationToken({
    tenantId: tenant.id,
    email: tenant.email,
    schemaName: tenant.schemaName,
    companyName: tenant.companyName,
    impersonatedBy: admin.email,
  });

  // Fire-and-forget audit trail so the impersonation is attributable.
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null;
  auditLog(
    "tenants",
    tenant.id,
    "SUPER_ACCESS",
    admin.email,
    undefined,
    { companyName: tenant.companyName, email: tenant.email },
    tenant.id,
    ip ?? undefined
  ).catch(() => {});

  const response = NextResponse.json({
    success: true,
    tenant: { id: tenant.id, companyName: tenant.companyName, email: tenant.email },
  });

  // 15 minutes matches the impersonation token's JWT expiry.
  response.cookies.set("tenant_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 15,
    path: "/",
  });

  return response;
}
