import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Select all columns except sensitive fields (phone, passwordHash)
  const result = await db
    .select({
      id: tenants.id,
      companyName: tenants.companyName,
      email: tenants.email,
      schemaName: tenants.schemaName,
      isActive: tenants.isActive,
      status: tenants.status,
      balance: tenants.balance,
      maxTps: tenants.maxTps,
      maxConcurrentCalls: tenants.maxConcurrentCalls,
      smppEnabled: tenants.smppEnabled,
      httpEnabled: tenants.httpEnabled,
      rcsEnabled: tenants.rcsEnabled,
      flashSmsEnabled: tenants.flashSmsEnabled,
      voiceOtpEnabled: tenants.voiceOtpEnabled,
      ottEnabled: tenants.ottEnabled,
      businessApiEnabled: tenants.businessApiEnabled,
      emailEnabled: tenants.emailEnabled,
      packageType: tenants.packageType,
      packagePrice: tenants.packagePrice,
      monthlyFee: tenants.monthlyFee,
      licenseKey: tenants.licenseKey,
      smsCounter: tenants.smsCounter,
      smsLimit: tenants.smsLimit,
      packageExpiresAt: tenants.packageExpiresAt,
      smppServerIp: tenants.smppServerIp,
      smppServerPort: tenants.smppServerPort,
      serverLocation: tenants.serverLocation,
      costPerSms: tenants.costPerSms,
      autoRenewEnabled: tenants.autoRenewEnabled,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(desc(tenants.id));

  return NextResponse.json({ tenants: result });
}
