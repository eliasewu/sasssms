import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const [t] = await db.select({
      id: tenants.id,
      companyName: tenants.companyName,
      email: tenants.email,
      phone: tenants.phone,
      balance: tenants.balance,
      schemaName: tenants.schemaName,
      packageType: tenants.packageType,
      packagePrice: tenants.packagePrice,
      licenseKey: tenants.licenseKey,
      smsCounter: tenants.smsCounter,
      smsLimit: tenants.smsLimit,
      smsValidUntil: tenants.smsValidUntil,
      lastRechargeAt: tenants.lastRechargeAt,
      monthlyFee: tenants.monthlyFee,
      packageExpiresAt: tenants.packageExpiresAt,
      smppServerIp: tenants.smppServerIp,
      smppServerPort: tenants.smppServerPort,
      costPerSms: tenants.costPerSms,
      isActive: tenants.isActive,
      smppEnabled: tenants.smppEnabled,
      httpEnabled: tenants.httpEnabled,
      rcsEnabled: tenants.rcsEnabled,
      voiceOtpEnabled: tenants.voiceOtpEnabled,
      ottEnabled: tenants.ottEnabled,
    }).from(tenants).where(eq(tenants.id, tenant.tenantId));

    if (!t) {
      return NextResponse.json({ error: "Account not found" }, { status: 401 });
    }

    return NextResponse.json({ tenant: t });
  } catch (error) {
    console.error("Auth me error:", error);
    // Fallback: return basic tenant info from token
    return NextResponse.json({
      tenant: {
        id: tenant.tenantId,
        companyName: tenant.companyName,
        email: tenant.email,
        isActive: true,
      },
    });
  }
}
