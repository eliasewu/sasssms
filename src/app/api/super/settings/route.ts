import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db, pool } from "@/db";
import { tenants, platformSettings, paymentConfig } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [settings, payments] = await Promise.all([
    db.select().from(platformSettings),
    (async () => {
      const client = await pool.connect();
      try {
        const result = await client.query(
          "SELECT id, method, label, is_active, credentials, qr_code_url, wallet_address, network, min_amount, created_at FROM payment_config"
        );
        return result.rows;
      } finally { client.release(); }
    })(),
  ]);
  const obj: Record<string, string> = {};
  settings.forEach(s => { obj[s.key] = s.value; });
  return NextResponse.json({ settings: obj, payments });
}

export async function PUT(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const gwId = url.searchParams.get("id");
  const body = await request.json();

  // Payment gateway update
  if (gwId) {
    const d: Record<string, unknown> = {};
    if (body.method !== undefined) d.method = body.method;
    if (body.label !== undefined) d.label = body.label;
    if (body.isActive !== undefined) d.isActive = body.isActive;
    if (body.credentials !== undefined) d.credentials = body.credentials;
    if (body.qrCodeUrl !== undefined) d.qrCodeUrl = body.qrCodeUrl;
    if (body.walletAddress !== undefined) d.walletAddress = body.walletAddress;
    if (body.network !== undefined) d.network = body.network;
    if (body.minAmount !== undefined) d.minAmount = body.minAmount;
    await db.update(paymentConfig).set(d).where(eq(paymentConfig.id, parseInt(gwId)));
    return NextResponse.json({ success: true });
  }

  // Upsert platform settings
  const upsert = async (key: string, value: string) => {
    const ex = await db.select().from(platformSettings).where(eq(platformSettings.key, key));
    if (ex.length > 0) await db.update(platformSettings).set({ value }).where(eq(platformSettings.key, key));
    else await db.insert(platformSettings).values({ key, value });
  };

  if (body.globalCostPerSms) await upsert("globalCostPerSms", body.globalCostPerSms);
  if (body.smppServerIp) await upsert("smppServerIp", body.smppServerIp);
  if (body.smppServerPort) await upsert("smppServerPort", String(body.smppServerPort));
  if (body.secondarySmppIp !== undefined) await upsert("secondarySmppIp", body.secondarySmppIp || "");

  // Auto-sync to all tenants
  let syncedCount = 0;
  if (body.syncToAllTenants) {
    const client = await pool.connect();
    try {
      const vals: string[] = [];
      if (body.globalCostPerSms) vals.push(`cost_per_sms = ${body.globalCostPerSms}`);
      if (body.smppServerIp) vals.push(`smpp_server_ip = '${body.smppServerIp}'`);
      if (body.smppServerPort) vals.push(`smpp_server_port = ${body.smppServerPort}`);
      if (vals.length > 0) {
        const { rowCount } = await client.query(`UPDATE tenants SET ${vals.join(", ")}, updated_at = NOW()`);
        syncedCount = rowCount || 0;
      }
    } finally { client.release(); }
  }

  return NextResponse.json({
    success: true,
    message: `Settings saved${syncedCount > 0 ? `. Synced to ${syncedCount} tenants.` : ""}`,
    syncedCount,
  });
}

export async function POST(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const [r] = await db.insert(paymentConfig).values({
    method: body.method, label: body.label,
    isActive: body.isActive ?? true,
    credentials: typeof body.credentials === "string" ? body.credentials : JSON.stringify(body.credentials || {}),
    qrCodeUrl: body.qrCodeUrl || null, walletAddress: body.walletAddress || null,
    network: body.network || null, minAmount: body.minAmount || "25",
  }).returning();
  return NextResponse.json({ config: r }, { status: 201 });
}

export async function DELETE(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  await db.delete(paymentConfig).where(eq(paymentConfig.id, parseInt(id)));
  return NextResponse.json({ success: true });
}
