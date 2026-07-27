import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await db
    .select({
      id: tenants.id,
      companyName: tenants.companyName,
      email: tenants.email,
      phone: tenants.phone,
      schemaName: tenants.schemaName,
      isActive: tenants.isActive,
      status: tenants.status,
      packageType: tenants.packageType,
      smsCounter: tenants.smsCounter,
      smsLimit: tenants.smsLimit,
      balance: tenants.balance,
      serverLocation: tenants.serverLocation,
      phoneVerified: tenants.phoneVerified,
      emailVerified: tenants.emailVerified,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(desc(tenants.id));

  return NextResponse.json({ tenants: result });
}
