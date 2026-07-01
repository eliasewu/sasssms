import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db } from "@/db";
import { tenants, packages } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [tenantStats] = await db.select({
    total: sql<number>`count(*)`,
    active: sql<number>`count(*) filter (where ${tenants.isActive} = true AND ${tenants.status} = 'active')`,
    suspended: sql<number>`count(*) filter (where ${tenants.status} = 'suspended')`,
    inactive: sql<number>`count(*) filter (where ${tenants.isActive} = false AND ${tenants.status} != 'suspended')`,
  }).from(tenants);

  const allTenants = await db.select().from(tenants).orderBy(sql`${tenants.createdAt} DESC`).limit(10);
  const allPackages = await db.select().from(packages);

  // Count by package type
  const packageCounts = await db.select({
    packageType: tenants.packageType,
    count: sql<number>`count(*)`,
  }).from(tenants).groupBy(tenants.packageType);

  return NextResponse.json({
    stats: {
      totalTenants: Number(tenantStats.total),
      activeTenants: Number(tenantStats.active),
      suspendedTenants: Number(tenantStats.suspended),
      inactiveTenants: Number(tenantStats.inactive),
      packageCounts,
    },
    recentTenants: allTenants,
    packages: allPackages,
  });
}
