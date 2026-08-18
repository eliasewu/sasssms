import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db, pool } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * PUT /api/super/voice-otp-config — push Voice OTP config settings to tenants.
 *
 * Body:
 *   { action: "seed-all" }                         → all active tenants
 *   { action: "seed-selected", tenantIds: [1,2,3] } → specific tenants
 *   settings: {
 *     playCount?: number    (digits repeated per OTP)
 *     retryCount?: number   (call retries)
 *     bilingual?: boolean
 *     languageMode?: "local" | "global" | ...
 *   }
 *
 * Only the provided settings are written — undefined fields leave tenant
 * values untouched. Every active voice_otp_config row in each tenant schema
 * is updated.
 */
export async function PUT(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const action = body.action;
  const tenantIds: number[] = body.tenantIds || [];
  const s = body.settings || {};

  if (action !== "seed-all" && action !== "seed-selected") {
    return NextResponse.json({ error: "Invalid action. Use 'seed-all' or 'seed-selected'" }, { status: 400 });
  }

  const hasSettings = s.playCount !== undefined || s.retryCount !== undefined ||
    s.bilingual !== undefined || s.languageMode !== undefined || s.playMode !== undefined;
  if (!hasSettings) {
    return NextResponse.json({ error: "No settings provided. Send playCount, retryCount, bilingual, languageMode, or playMode." }, { status: 400 });
  }

  if (action === "seed-selected" && tenantIds.length === 0) {
    return NextResponse.json({ error: "Select at least one tenant" }, { status: 400 });
  }

  let allTenants = await db.select({ id: tenants.id, schemaName: tenants.schemaName, companyName: tenants.companyName })
    .from(tenants)
    .where(eq(tenants.isActive, true));

  const targetTenants = action === "seed-selected"
    ? allTenants.filter(t => tenantIds.includes(t.id))
    : allTenants;

  // Build the SET fragment from provided settings only.
  const sets: string[] = [];
  const params: unknown[] = [];
  if (s.playCount !== undefined) { params.push(s.playCount); sets.push(`play_count = $${params.length}`); }
  if (s.retryCount !== undefined) { params.push(s.retryCount); sets.push(`retry_count = $${params.length}`); }
  if (s.bilingual !== undefined) { params.push(!!s.bilingual); sets.push(`bilingual = $${params.length}`); }
  if (s.languageMode !== undefined) { params.push(s.languageMode); sets.push(`language_mode = $${params.length}`); }
  if (s.playMode !== undefined) { params.push(s.playMode); sets.push(`play_mode = $${params.length}`); }
  const setSql = sets.join(", ");

  let updatedConfigs = 0;
  let updatedTenants = 0;
  const errors: string[] = [];
  const client = await pool.connect();
  try {
    for (const tenant of targetTenants) {
      try {
        const r = await client.query(
          `UPDATE "${tenant.schemaName}".voice_otp_config SET ${setSql} WHERE is_active = true`
        , params);
        if (r.rowCount && r.rowCount > 0) {
          updatedConfigs += r.rowCount;
          updatedTenants++;
        }
      } catch (e) {
        errors.push(`${tenant.companyName}: ${(e as Error).message}`);
      }
    }
  } finally {
    client.release();
  }

  const message = errors.length > 0
    ? `Updated ${updatedTenants}/${targetTenants.length} tenant(s) (${updatedConfigs} configs, ${errors.length} errors)`
    : `Updated ${updatedTenants}/${targetTenants.length} tenant(s) (${updatedConfigs} configs)`;

  return NextResponse.json({
    success: true,
    message,
    updatedTenants,
    updatedConfigs,
    totalTenants: targetTenants.length,
    errorCount: errors.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
