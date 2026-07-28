import { NextResponse } from "next/server";
import { db, pool } from "@/db";
import { tenants } from "@/db/schema";
import { hashPassword, createToken } from "@/lib/auth";
import { createTenantSchema, seedMccMncRates } from "@/lib/tenant-schema";
import { eq } from "drizzle-orm";
import { safeInt, safeDecimal, safeText } from "@/lib/validation";
import { ALL_SERVER_IPS, getSelfIp } from "@/lib/server-ips";
import { registerLimiter, getClientIp } from "@/lib/rate-limit";
import { sendTenantWelcomeEmail, getAdminEmail } from "@/lib/email-service";

async function getSignupBonus(): Promise<number> {
  try {
    const { rows } = await pool.query("SELECT value FROM platform_settings WHERE key = 'signup_bonus_sms'");
    return parseInt(rows[0]?.value || "100");
  } catch { return 100; }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyName, email, phone, password } = body;
    // Auto-assign a random active server — server IPs are never exposed to users
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

    // ── Auto-assign server: pick a random active location from platform_settings ──
    try {
      const locResult = await pool.query("SELECT value FROM platform_settings WHERE key = 'server_locations'");
      if (locResult.rows.length > 0) {
        const locations: Array<{ id: string; ipAddress: string; isActive: boolean }> = JSON.parse(locResult.rows[0].value || "[]");
        const active = locations.filter(l => l.isActive && l.ipAddress && l.ipAddress !== "0.0.0.0");
        if (active.length > 0) {
          const pick = active[Math.floor(Math.random() * active.length)];
          resolvedLocation = pick.id;
          assignedServerIp = pick.ipAddress;
        }
      }
    } catch (e) { console.error("Server location lookup failed:", e); }
    // Fall back to global smppServerIp if no active locations found
    if (!assignedServerIp || assignedServerIp === "0.0.0.0") {
      try {
        const globalIpResult = await pool.query("SELECT value FROM platform_settings WHERE key = 'smppServerIp'");
        if (globalIpResult.rows.length > 0 && globalIpResult.rows[0].value && globalIpResult.rows[0].value !== "0.0.0.0") {
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
    // ── Notify admin of new registration (best-effort, non-blocking) ──
    const signupBonusSms = tenant.smsLimit; // reuse already-fetched value
    (async () => {
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({
          host: process.env.SMTP_HOST || "mail.net2app.com",
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: parseInt(process.env.SMTP_PORT || "587") === 465,
          auth: { user: process.env.SMTP_USER || "welcome@net2app.com", pass: process.env.SMTP_PASS || "" },
        });
        await transporter.sendMail({
          from: `"Net2APP Notifications" <${process.env.SMTP_USER || "welcome@net2app.com"}>`,
          to: await getAdminEmail(),
          subject: `🆕 New Tenant: ${tenant.companyName}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2 style="color:#2563eb;">New Tenant Registration</h2>
            <p><strong>Company:</strong> ${tenant.companyName}</p>
            <p><strong>Email:</strong> ${tenant.email}</p>
            <p><strong>Phone:</strong> ${safeText(phone, 50)}</p>
            <p><strong>Plan:</strong> Starter (${platformRate}/SMS)</p>
            <p><strong>SMS Credits:</strong> ${signupBonusSms}</p>
            <p><strong>Server IP:</strong> ${assignedServerIp}</p>
            <hr style="margin:20px 0" />
            <p style="color:#94a3b8;font-size:11px;">📱 WhatsApp: +971505380825 | Net2APP Platform</p>
          </div>`,
        });
      } catch { /* notification is best-effort */ }
    })();

    // ── Send welcome email to tenant (best-effort, non-blocking) ──
    (async () => {
      sendTenantWelcomeEmail({
        tenantEmail: tenant.email,
        tenantName: tenant.companyName,
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
