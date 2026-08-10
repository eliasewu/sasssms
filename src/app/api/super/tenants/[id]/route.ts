import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db, pool } from "@/db";
import { tenants } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { safeInt, safeDecimal, safeBool, safeText } from "@/lib/validation";
import { isDevServer } from "@/lib/server-ips";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (body.isActive !== undefined) updateData.isActive = safeBool(body.isActive, true);
  if (body.status !== undefined) updateData.status = safeText(body.status, 20, "active");
  if (body.smppEnabled !== undefined) updateData.smppEnabled = safeBool(body.smppEnabled, true);
  if (body.httpEnabled !== undefined) updateData.httpEnabled = safeBool(body.httpEnabled, true);
  if (body.rcsEnabled !== undefined) updateData.rcsEnabled = safeBool(body.rcsEnabled, true);
  if (body.flashSmsEnabled !== undefined) updateData.flashSmsEnabled = safeBool(body.flashSmsEnabled, true);
  if (body.voiceOtpEnabled !== undefined) updateData.voiceOtpEnabled = safeBool(body.voiceOtpEnabled, true);
  if (body.ottEnabled !== undefined) updateData.ottEnabled = safeBool(body.ottEnabled, true);
  if (body.businessApiEnabled !== undefined) updateData.businessApiEnabled = safeBool(body.businessApiEnabled, true);
  if (body.emailEnabled !== undefined) updateData.emailEnabled = safeBool(body.emailEnabled, true);
  if (body.autoRenewEnabled !== undefined) updateData.autoRenewEnabled = safeBool(body.autoRenewEnabled, true);

  // Approval/toggle audit — the audit rows are written by the DB triggers
  // (drizzle/0038 auto-connect + 0039 feature toggles) atomically with the
  // UPDATE below, so changes from ANY path (UI route, future APIs, scripts,
  // raw SQL) are traceable. When the body touches an audited toggle column,
  // the update runs in a transaction with app.changed_by / app.ip_address
  // GUCs set, which the triggers read to record the acting admin + IP.
  if (body.autoConnectEnabled !== undefined) {
    updateData.autoConnectEnabled = safeBool(body.autoConnectEnabled, true);
  }
  if (body.packageType !== undefined) updateData.packageType = safeText(body.packageType, 50, "starter");
  if (body.balance !== undefined) updateData.balance = safeDecimal(body.balance, "0");
  if (body.maxTps !== undefined) updateData.maxTps = safeInt(body.maxTps, 0);
  if (body.costPerSms !== undefined) updateData.costPerSms = safeDecimal(body.costPerSms, "0.00025");
  if (body.smsLimit !== undefined) updateData.smsLimit = safeInt(body.smsLimit, 0);
  if (body.smsCounter !== undefined) updateData.smsCounter = safeInt(body.smsCounter, 0);
  if (body.maxConcurrentCalls !== undefined) updateData.maxConcurrentCalls = safeInt(body.maxConcurrentCalls, 10);
  if (body.packageExpiresAt !== undefined) {
    updateData.packageExpiresAt = body.packageExpiresAt ? new Date(body.packageExpiresAt) : null;
  }

  // SMPP server assignment — dev servers can never be (re)assigned to tenants.
  // A tenant already on a dev server keeps it until the admin picks a
  // production server; unrelated edits must not be blocked by the guard.
  if (body.smppServerIp !== undefined) {
    const ip = safeText(body.smppServerIp, 100, "0.0.0.0");
    if (isDevServer(ip)) {
      const [current] = await db
        .select({ smppServerIp: tenants.smppServerIp })
        .from(tenants)
        .where(eq(tenants.id, parseInt(id)));
      if (!current || (current.smppServerIp || "0.0.0.0") !== ip) {
        return NextResponse.json(
          { error: "This server is a development server and cannot be assigned to tenants." },
          { status: 400 }
        );
      }
      // Incoming dev IP matches current — leave it unchanged (no-op).
    } else {
      updateData.smppServerIp = ip;
    }
  }
  if (body.serverLocation !== undefined) {
    updateData.serverLocation = safeText(body.serverLocation, 50, "auto");
  }

  // If status is SUSPENDED, also deactivate
  if (updateData.status === "suspended") {
    updateData.isActive = false;
  }

  // Columns audited by the 0038/0039 triggers — if any of them is present in
  // the body, the UPDATE must run inside the GUC-carrying transaction.
  const AUDITED_TOGGLES = [
    "autoConnectEnabled", "smppEnabled", "httpEnabled", "rcsEnabled",
    "flashSmsEnabled", "voiceOtpEnabled", "ottEnabled",
    "businessApiEnabled", "emailEnabled", "autoRenewEnabled",
  ];
  const touchesAuditedToggle = AUDITED_TOGGLES.some((f) => body[f] !== undefined);

  let result: (typeof tenants.$inferSelect) | undefined;
  if (touchesAuditedToggle) {
    // Transaction-local GUCs — scoped to this transaction only, so the trigger
    // attributes the change to the acting admin, and the values auto-clear on
    // commit/rollback (never leak to the next pooled query).
    const clientIp =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      null;
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.changed_by', ${admin.email}, true)`);
      await tx.execute(sql`SELECT set_config('app.ip_address', ${clientIp || ""}, true)`);
      [result] = await tx.update(tenants)
        .set(updateData as any)
        .where(eq(tenants.id, parseInt(id)))
        .returning();
    });
  } else {
    [result] = await db.update(tenants)
      .set(updateData as any)
      .where(eq(tenants.id, parseInt(id)))
      .returning();
  }

  return NextResponse.json({ tenant: result });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const tenantId = parseInt(id);

  // Get tenant info for schema cleanup
  const [tenant] = await db.select({ schemaName: tenants.schemaName }).from(tenants).where(eq(tenants.id, tenantId));

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  // Drop tenant schema (hard delete)
  try {
    const client = await pool.connect();
    await client.query(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE`);
    client.release();
  } catch (e) {
    console.error("Schema drop error:", e);
  }

  // Delete tenant record
  await db.delete(tenants).where(eq(tenants.id, tenantId));

  return NextResponse.json({ success: true, message: `Tenant and schema "${tenant.schemaName}" permanently deleted` });
}
