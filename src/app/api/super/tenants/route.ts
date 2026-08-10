import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db, pool } from "@/db";
import { tenants } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getTenantApiUsageSummary, getTenantSchemaStorageBytes } from "@/lib/tenant-usage";
import type { TenantUsageSummary } from "@/lib/tenant-usage";

export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Real per-tenant API load (CPU/RAM proxy) + exact per-schema storage.
  // Both are best-effort: a missing table or permission error must not break
  // the tenants list, so failures fall back to empty maps.
  let usageByTenant = new Map<number, TenantUsageSummary>();
  let storageBySchema = new Map<string, number>();
  try {
    [usageByTenant, storageBySchema] = await Promise.all([
      getTenantApiUsageSummary(),
      getTenantSchemaStorageBytes(),
    ]);
  } catch (e) {
    console.error("[super/tenants] usage/storage query failed:", (e as Error).message);
  }

  // Latest 3proxy installer download per tenant (from the proxy_installer
  // audit trail) — lets the table show approval status + last download at a
  // glance. Best-effort: a missing audit_log table must not break the list.
  type InstallerDownload = { at: string; os: string | null; filename: string | null; embeddedAuthKey: boolean };
  let lastInstallerDownload = new Map<number, InstallerDownload>();
  try {
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `SELECT DISTINCT ON (tenant_id) tenant_id,
                created_at AS at,
                new_data::jsonb->>'os' AS os,
                new_data::jsonb->>'filename' AS filename,
                COALESCE((new_data::jsonb->>'embeddedAuthKey')::boolean, false) AS "embeddedAuthKey"
         FROM audit_log
         WHERE entity_type = 'proxy_installer' AND tenant_id IS NOT NULL
         ORDER BY tenant_id, created_at DESC`
      );
      for (const r of rows) {
        lastInstallerDownload.set(Number(r.tenant_id), {
          at: r.at,
          os: r.os ?? null,
          filename: r.filename ?? null,
          embeddedAuthKey: r.embeddedAuthKey === true,
        });
      }
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("[super/tenants] installer-download query failed:", (e as Error).message);
  }

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
      autoConnectEnabled: tenants.autoConnectEnabled,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(desc(tenants.id));

  // Attach usage + storage to each tenant (null when nothing recorded yet).
  const tenantsWithUsage = result.map((t) => ({
    ...t,
    usage: usageByTenant.get(t.id) ?? null,
    storageBytes: storageBySchema.get(t.schemaName) ?? null,
    lastInstallerDownload: lastInstallerDownload.get(t.id) ?? null,
  }));

  return NextResponse.json({ tenants: tenantsWithUsage });
}
