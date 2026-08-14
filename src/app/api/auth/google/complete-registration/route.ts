import { NextResponse } from "next/server";
import { db, pool } from "@/db";
import { tenants } from "@/db/schema";
import { createToken, hashPassword } from "@/lib/auth";
import { createTenantSchema, seedMccMncRates } from "@/lib/tenant-schema";
import { safeText, safeDecimal } from "@/lib/validation";
import { ALL_SERVER_IPS, getSelfIp, isDevServer } from "@/lib/server-ips";
import { countryCodeFromPhone, pickServerForPackage } from "@/lib/server-assignment";
import { notifyAdminNewTenant } from "@/lib/email-service";
import { eq } from "drizzle-orm";
import crypto from "crypto";

async function getSignupBonus(): Promise<number> {
  try {
    const { rows } = await pool.query("SELECT value FROM platform_settings WHERE key = 'signup_bonus_sms'");
    return parseInt(rows[0]?.value || "100");
  } catch { return 100; }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { state, phone, googleId, name: googleName, acceptTerms } = body;

    if (!state || !phone || !googleId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // ── Terms & Conditions acceptance required ──
    if (acceptTerms !== true && acceptTerms !== "true") {
      return NextResponse.json({ error: "You must accept the Terms & Conditions to create an account." }, { status: 400 });
    }

    // Validate the session token (stored in password_reset_tokens)
    const { rows: tokenRows } = await pool.query(
      "SELECT email, expires_at, used FROM password_reset_tokens WHERE token = $1 AND used = false LIMIT 1",
      [state]
    );

    if (tokenRows.length === 0) {
      return NextResponse.json({ error: "Session expired or already used. Please try signing up again." }, { status: 400 });
    }

    const tokenRow = tokenRows[0];
    if (new Date(tokenRow.expires_at) < new Date()) {
      return NextResponse.json({ error: "Session expired. Please try signing up again." }, { status: 400 });
    }

    // Mark the session token as used
    await pool.query("UPDATE password_reset_tokens SET used = true WHERE token = $1", [state]);

    const email = tokenRow.email;
    const normalizedEmail = email.toLowerCase().trim();

    // Use Google profile name if available, otherwise fall back to email prefix
    const name = (googleName && googleName.trim()) || email.split("@")[0];

    // Double-check: tenant not already created (race condition safety)
    const existing = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.email, normalizedEmail));
    if (existing.length > 0) {
      return NextResponse.json({ error: "This email is already registered. Please login instead." }, { status: 409 });
    }

    // Get platform rate
    let platformRate = "0.00010";
    try {
      const pc = await pool.connect();
      const { rows } = await pc.query("SELECT value FROM platform_settings WHERE key = 'globalCostPerSms'");
      pc.release();
      if (rows.length > 0) platformRate = rows[0].value;
    } catch { /* fallback */ }

    // Generate unique schema name
    // Use a generic prefix since we don't have company name (will use name from Google)
    const schemaName = "tenant_google_" + Date.now();

    // Use a random password hash (user won't use password — they'll use Google)
    const randomPassword = crypto.randomBytes(32).toString("hex");
    const passwordHash = await hashPassword(randomPassword);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Auto-assign server by package + region. Dev servers (role "development"
    // or in DEV_SERVER_IPS) are never assignable — tenants only land on
    // production boxes. Starter clients are routed by region/latency with
    // ascending-order (least-loaded) selection; Professional/Enterprise are
    // assigned manually by a super admin.
    let resolvedLocation = "auto";
    let assignedServerIp = "0.0.0.0";
    try {
      const locResult = await pool.query("SELECT value FROM platform_settings WHERE key = 'server_locations'");
      if (locResult.rows.length > 0) {
        const locations = JSON.parse(locResult.rows[0].value || "[]");
        const loadResult = await pool.query(
          `SELECT smpp_server_ip, COUNT(*)::int AS c FROM tenants
           WHERE smpp_server_ip IS NOT NULL AND smpp_server_ip <> '0.0.0.0' AND is_active = true
           GROUP BY smpp_server_ip`
        );
        const loads: Record<string, number> = {};
        for (const row of loadResult.rows) loads[row.smpp_server_ip] = row.c;

        const pick = pickServerForPackage(locations, {
          package: "starter",
          countryCode: countryCodeFromPhone(safeText(phone, 50)),
          loads,
        });
        if (pick) {
          resolvedLocation = pick.id;
          assignedServerIp = pick.ipAddress;
        }
      }
    } catch { /* fallback */ }
    // If still unset or pointing at a dev box, fall back to the global
    // production smppServerIp (also skipping dev IPs).
    if (!assignedServerIp || assignedServerIp === "0.0.0.0" || isDevServer(assignedServerIp)) {
      try {
        const globalIpResult = await pool.query("SELECT value FROM platform_settings WHERE key = 'smppServerIp'");
        if (globalIpResult.rows.length > 0 && globalIpResult.rows[0].value && globalIpResult.rows[0].value !== "0.0.0.0" && !isDevServer(globalIpResult.rows[0].value)) {
          assignedServerIp = globalIpResult.rows[0].value;
        }
      } catch { /* fallback */ }
    }

    // Get the name from the request (Google profile name passed from phone page)
    // Already computed above

    const [tenant] = await db.insert(tenants).values({
      companyName: safeText(name, 255),
      email: normalizedEmail,
      phone: safeText(phone, 50),
      passwordHash,
      googleId,
      schemaName,
      smppServerIp: assignedServerIp,
      smppServerPort: 2775,
      serverLocation: safeText(resolvedLocation, 50),
      costPerSms: safeDecimal(platformRate, "0.00025"),
      smsLimit: await getSignupBonus(),
      accountExpiresAt: expiresAt,
      emailVerified: true,
      phoneVerified: false,
    }).returning();

    // Create isolated tenant schema
    await createTenantSchema(schemaName);

    // Seed MCC/MNC rates (fire-and-forget)
    seedMccMncRates(schemaName).catch(e => console.error("MCC/MNC seed failed:", e));

    // Seed Voice OTP audio defaults
    try {
      const pc = await pool.connect();
      try {
        await pc.query(
          `INSERT INTO "${schemaName}".voice_otp_audio (config_id, language, digit, file_name, file_url, audio_type)
           SELECT vc.id, da.language, da.digit, da.file_name, da.file_url, COALESCE(da.audio_type, 'wav')
           FROM voice_otp_default_audio da
           JOIN "${schemaName}".voice_otp_config vc
             ON vc.primary_language = da.language OR vc.secondary_language = da.language
           WHERE NOT EXISTS (
             SELECT 1 FROM "${schemaName}".voice_otp_audio va
             WHERE va.config_id = vc.id AND va.language = da.language AND va.digit = da.digit
           )`
        );
      } finally { pc.release(); }
    } catch { /* non-fatal */ }

    const token = createToken({
      tenantId: tenant.id,
      email: tenant.email,
      schemaName: tenant.schemaName,
      companyName: tenant.companyName,
    });

    const response = NextResponse.json({ success: true, redirect: "/dashboard" });

    response.cookies.set("tenant_token", token, {
      httpOnly: true, secure: true, sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, path: "/",
    });

    // Replicate to other servers (fire-and-forget)
    const tenantData = {
      companyName: tenant.companyName,
      email: tenant.email,
      phone: safeText(phone, 50),
      passwordHash: tenant.passwordHash,
      schemaName: tenant.schemaName,
      smppServerIp: assignedServerIp,
      serverLocation: resolvedLocation,
      costPerSms: platformRate,
      smsLimit: tenant.smsLimit,
    };
    const SYNC_SECRET = process.env.INTERNAL_SYNC_SECRET || "net2app-internal-sync-2024";
    const selfIp = await getSelfIp();
    ALL_SERVER_IPS.filter((ip: string) => ip !== selfIp && ip !== "127.0.0.1").forEach((ip: string) => {
      fetch(`http://${ip}:5556/api/internal/sync-tenant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SYNC_SECRET}` },
        body: JSON.stringify(tenantData),
      }).catch(() => {});
    });

    // ── Notify admin of the new Google-signup tenant (best-effort, non-blocking)
    //    so they can review whether to keep Auto-Connect Installer enabled ──
    (async () => {
      notifyAdminNewTenant({
        tenantName: tenant.companyName,
        tenantEmail: tenant.email,
        phone: safeText(phone, 50),
        serverIp: assignedServerIp,
        signupBonusSms: tenant.smsLimit ?? undefined,
        viaGoogle: true,
      }).catch(e => console.error("New-tenant admin notification failed:", e));
    })();

    return response;
  } catch (error: unknown) {
    console.error("Google registration complete error:", error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
