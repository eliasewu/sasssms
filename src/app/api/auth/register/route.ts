import { NextResponse } from "next/server";
import { db, pool } from "@/db";
import { tenants } from "@/db/schema";
import { hashPassword, createToken } from "@/lib/auth";
import { createTenantSchema, seedMccMncRates } from "@/lib/tenant-schema";
import { eq } from "drizzle-orm";
import { safeInt, safeDecimal, safeText } from "@/lib/validation";
import { ALL_SERVER_IPS, getSelfIp, isDevServer } from "@/lib/server-ips";
import { countryCodeFromPhone, pickServerForPackage } from "@/lib/server-assignment";
import { registerLimiter, getClientIp } from "@/lib/rate-limit";
import { sendTenantWelcomeEmail, notifyAdminNewTenant } from "@/lib/email-service";

async function getSignupBonus(): Promise<number> {
  try {
    const { rows } = await pool.query("SELECT value FROM platform_settings WHERE key = 'signup_bonus_sms'");
    return parseInt(rows[0]?.value || "100");
  } catch { return 100; }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyName, email, phone, password, acceptTerms } = body;

    // ── Terms & Conditions acceptance required ──
    if (acceptTerms !== true && acceptTerms !== "true") {
      return NextResponse.json({ error: "You must accept the Terms & Conditions to create an account." }, { status: 400 });
    }

    // Auto-assign a server — server IPs are never exposed to users.
    // Starter clients are routed by region/latency (phone dialing code →
    // Europe/Africa → European & USA servers; Asia/Australia → Sydney/
    // Singapore) with ascending-order (least-loaded) selection. Professional
    // and Enterprise clients are assigned manually by a super admin, so they
    // stay unassigned until then.
    let resolvedLocation = "";
    let assignedServerIp = "0.0.0.0";

    // Rate limit: max 3 registrations per IP per hour
    const clientIp = getClientIp(request);
    if (registerLimiter.check(clientIp)) {
      return NextResponse.json({ error: "Too many registration attempts. Please try again later." }, { status: 429 });
    }

    if (!companyName || !email || !phone || !password) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if tenant already exists
    const existing = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.email, normalizedEmail));
    if (existing.length > 0) {
      return NextResponse.json({ 
        error: "This email is already registered. Please login instead.",
        existingAccount: true,
      }, { status: 409 });
    }

    // ── Get current platform rate from settings ──
    let platformRate = "0.00010"; // fallback
    try {
      const pc = await pool.connect();
      const { rows } = await pc.query("SELECT value FROM platform_settings WHERE key = 'globalCostPerSms'");
      pc.release();
      if (rows.length > 0) platformRate = rows[0].value;
    } catch { /* use fallback */ }
    // ────────────────────────────────────────────

    // Generate unique schema name
    const sanitizedName = companyName.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30);
    const schemaName = "tenant_" + sanitizedName + "_" + Date.now();

    const passwordHash = await hashPassword(password);

    // Expires in 30 days if not topped up
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // ── Auto-assign server by package + region ──
    // Dev servers (role "development" or in DEV_SERVER_IPS) are never
    // assignable — tenants only land on production boxes.
    try {
      const locResult = await pool.query("SELECT value FROM platform_settings WHERE key = 'server_locations'");
      if (locResult.rows.length > 0) {
        const locations = JSON.parse(locResult.rows[0].value || "[]");
        // Tenant load per server for ascending-order (least-loaded) selection
        const loadResult = await pool.query(
          `SELECT smpp_server_ip, COUNT(*)::int AS c FROM tenants
           WHERE smpp_server_ip IS NOT NULL AND smpp_server_ip <> '0.0.0.0' AND is_active = true
           GROUP BY smpp_server_ip`
        );
        const loads: Record<string, number> = {};
        for (const row of loadResult.rows) loads[row.smpp_server_ip] = row.c;

        const pick = pickServerForPackage(locations, {
          package: "starter", // new signups are always starter until an admin upgrades
          countryCode: countryCodeFromPhone(safeText(phone, 50)),
          loads,
        });
        if (pick) {
          resolvedLocation = pick.id;
          assignedServerIp = pick.ipAddress;
        }
      }
    } catch (e) { console.error("Server location lookup failed:", e); }
    // Fall back to global smppServerIp if no matching server found (skip dev IPs too)
    if (!assignedServerIp || assignedServerIp === "0.0.0.0" || isDevServer(assignedServerIp)) {
      try {
        const globalIpResult = await pool.query("SELECT value FROM platform_settings WHERE key = 'smppServerIp'");
        if (globalIpResult.rows.length > 0 && globalIpResult.rows[0].value && globalIpResult.rows[0].value !== "0.0.0.0" && !isDevServer(globalIpResult.rows[0].value)) {
          assignedServerIp = globalIpResult.rows[0].value;
        }
      } catch { /* use hardcoded fallback */ }
    }
    if (!resolvedLocation) resolvedLocation = "auto";
    // ────────────────────────────────────────────

    const [tenant] = await db.insert(tenants).values({
      companyName: safeText(companyName, 255),
      email: normalizedEmail,
      phone: safeText(phone, 50),
      passwordHash,
      schemaName,
      smppServerIp: assignedServerIp,
      smppServerPort: 2775,
      serverLocation: safeText(resolvedLocation, 50),
      costPerSms: safeDecimal(platformRate, "0.00025"),      // ← uses current platform rate
      smsLimit: await getSignupBonus(),                           // ← configurable signup bonus from platform_settings
      accountExpiresAt: expiresAt,
      emailVerified: true,
      phoneVerified: true,
    }).returning();

    // Create isolated tenant schema with all 27 tables + Voice OTP defaults
    await createTenantSchema(schemaName);

    // ── Seed MCC/MNC rates from global database into new tenant ──
    seedMccMncRates(schemaName).catch(e =>
      console.error("MCC/MNC seed failed for new tenant:", e)
    );

    // ── Seed default Voice OTP audio from super admin defaults into tenant schema (single batch INSERT) ──
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
      } finally {
        pc.release();
      }
    } catch (e) {
      // Non-fatal: defaults table may not exist yet, or no defaults configured
      console.error("Voice OTP default seeding failed:", e);
    }
    // ──────────────────────────────────────────────────────────────────────

    const token = createToken({
      tenantId: tenant.id,
      email: tenant.email,
      schemaName: tenant.schemaName,
      companyName: tenant.companyName,
    });

    const response = NextResponse.json({
      success: true,
      tenant: { id: tenant.id, companyName: tenant.companyName, email: tenant.email, costPerSms: platformRate },
      token,
    });

    // ── Replicate tenant to ALL other servers (fire-and-forget) ──
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
    ALL_SERVER_IPS.filter((ip: string) => ip !== selfIp && ip !== "127.0.0.1").forEach(ip => {
      fetch(`http://${ip}:5556/api/internal/sync-tenant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SYNC_SECRET}` },
        body: JSON.stringify(tenantData),
      }).catch(e => console.error(`[Replicate] Failed to sync tenant to ${ip}:`, e.message));
    });
    // ── Notify admin of new registration (best-effort, non-blocking) so they
    //    can review whether to keep Auto-Connect Installer enabled for them ──
    (async () => {
      notifyAdminNewTenant({
        tenantName: tenant.companyName,
        tenantEmail: tenant.email,
        phone: safeText(phone, 50),
        serverIp: assignedServerIp,
        signupBonusSms: tenant.smsLimit ?? undefined,
        platformRate,
      }).catch(e => console.error("New-tenant admin notification failed:", e));
    })();

    // ── Send welcome email to tenant (best-effort, non-blocking) ──
    (async () => {
      sendTenantWelcomeEmail({
        tenantEmail: tenant.email,
        tenantName: tenant.companyName,
        tenantPassword: password,
        serverIp: assignedServerIp,
        smppPort: 2775,
        httpPort: 5556,
      }).catch(e => console.error("Welcome email failed:", e));
    })();
    // ──────────────────────────────────────────

    response.cookies.set("tenant_token", token, {
      httpOnly: true, secure: true, sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, path: "/",
    });

    return response;
  } catch (error: unknown) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
