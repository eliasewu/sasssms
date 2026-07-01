import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { getMccTrafficStats } from "@/lib/db-helpers";
import { db } from "@/db";
import { tenants } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId");

  // Get all tenants
  const allTenants = await db.select({ id: tenants.id, companyName: tenants.companyName }).from(tenants);

  let stats = [];
  if (tenantId) {
    stats = await getMccTrafficStats(parseInt(tenantId));
  } else {
    // Aggregate all
    for (const t of allTenants) {
      const tenantStats = await getMccTrafficStats(t.id);
      stats.push(...tenantStats.map(s => ({ ...s, tenant_id: t.id, tenant_name: t.companyName })));
    }
  }

  return NextResponse.json({
    tenants: allTenants,
    stats,
  });
}
