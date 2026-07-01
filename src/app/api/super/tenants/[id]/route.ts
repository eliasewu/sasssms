import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db, pool } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { safeInt, safeDecimal, safeBool, safeText } from "@/lib/validation";

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
  if (body.packageType !== undefined) updateData.packageType = safeText(body.packageType, 50, "starter");
  if (body.balance !== undefined) updateData.balance = safeDecimal(body.balance, "0");
  if (body.maxTps !== undefined) updateData.maxTps = safeInt(body.maxTps, 0);
  if (body.costPerSms !== undefined) updateData.costPerSms = safeDecimal(body.costPerSms, "0.00025");
  if (body.smsLimit !== undefined) updateData.smsLimit = safeInt(body.smsLimit, 0);
  if (body.smsCounter !== undefined) updateData.smsCounter = safeInt(body.smsCounter, 0);
  if (body.maxConcurrentCalls !== undefined) updateData.maxConcurrentCalls = safeInt(body.maxConcurrentCalls, 10);

  // If status is SUSPENDED, also deactivate
  if (updateData.status === "suspended") {
    updateData.isActive = false;
  }

  const [result] = await db.update(tenants)
    .set(updateData as any)
    .where(eq(tenants.id, parseInt(id)))
    .returning();

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
