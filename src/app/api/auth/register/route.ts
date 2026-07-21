import { NextResponse } from "next/server";
import { db, pool } from "@/db";
import { tenants } from "@/db/schema";
import { hashPassword, createToken } from "@/lib/auth";
import { createTenantSchema, seedMccMncRates } from "@/lib/tenant-schema";
import { eq } from "drizzle-orm";
import { safeInt, safeDecimal, safeText } from "@/lib/validation";

async function getSignupBonus(): Promise<number> {
  try {
    const { rows } = await pool.query("SELECT value FROM platform_settings WHERE key = 'signup_bonus_sms'");
    return parseInt(rows[0]?.value || "100");
  } catch { return 100; }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyName, email, phone, password, serverLocation } = body;

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

    // ── Get server IP for chosen location ──
    // Priority: 1) matched location's IP, 2) global smppServerIp from platform settings, 3) "0.0.0.0"
    let assignedServerIp = "0.0.0.0";
    
    // First, get global default IP from platform settings as fallback
    try {
      const globalIpResult = await pool.query("SELECT value FROM platform_settings WHERE key = 'smppServerIp'");
      if (globalIpResult.rows.length > 0 && globalIpResult.rows[0].value && globalIpResult.rows[0].value !== "0.0.0.0") {
        assignedServerIp = globalIpResult.rows[0].value;
      }
    } catch { /* use hardcoded fallback */ }
    
    // Then try to match the chosen server location (overrides global default if found)
    if (serverLocation) {
      try {
        const locResult = await pool.query("SELECT value FROM platform_settings WHERE key = 'server_locations'");
        if (locResult.rows.length > 0) {
          const locations = JSON.parse(locResult.rows[0].value || "[]");
          const matched = locations.find((l: any) => l.id === serverLocation || l.country === serverLocation);
          if (matched && matched.ipAddress && matched.ipAddress !== "0.0.0.0" && matched.ipAddress !== "") {
            assignedServerIp = matched.ipAddress;
          }
        }
      } catch (e) { console.error("Server location lookup failed:", e); }
    }
    // ────────────────────────────────────────────

    const [tenant] = await db.insert(tenants).values({
      companyName: safeText(companyName, 255),
      email: normalizedEmail,
      phone: safeText(phone, 50),
      passwordHash,
      schemaName,
      smppServerIp: assignedServerIp,
      smppServerPort: 2775,
      serverLocation: serverLocation ? safeText(serverLocation, 50) : null,
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

    // ── Seed default Voice OTP audio from super admin defaults into tenant schema ──
    try {
      const defResult = await pool.query("SELECT * FROM voice_otp_default_audio ORDER BY language, digit");
      if (defResult.rows.length > 0) {
        const client = await pool.connect();
        try {
          for (const def of defResult.rows) {
            // Find matching config_id in tenant schema
            const configResult = await client.query(
              `SELECT id FROM "${schemaName}".voice_otp_config WHERE primary_language = $1 OR secondary_language = $1 LIMIT 1`,
              [def.language]
            );
            if (configResult.rows.length > 0) {
              const configId = configResult.rows[0].id;
              // Check if this audio already exists
              const existingAudio = await client.query(
                `SELECT id FROM "${schemaName}".voice_otp_audio WHERE config_id = $1 AND language = $2 AND digit = $3`,
                [configId, def.language, def.digit]
              );
              if (existingAudio.rows.length === 0) {
                await client.query(
                  `INSERT INTO "${schemaName}".voice_otp_audio (config_id, language, digit, file_name, file_url, audio_type) VALUES ($1, $2, $3, $4, $5, $6)`,
                  [configId, def.language, def.digit, def.file_name, def.file_url, def.audio_type || 'wav']
                );
              }
            }
          }
        } finally {
          client.release();
        }
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

    // ── Notify admin of new registration (best-effort, non-blocking) ──
    const signupBonusSms = tenant.smsLimit; // reuse already-fetched value
    (async () => {
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({
          host: process.env.SMTP_HOST || "mail.net2app.com",
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: parseInt(process.env.SMTP_PORT || "587") === 465,
          auth: { user: process.env.SMTP_USER || "noreply@net2app.com", pass: process.env.SMTP_PASS || "" },
        });
        await transporter.sendMail({
          from: `"Net2APP Notifications" <${process.env.SMTP_USER || "noreply@net2app.com"}>`,
          to: "elias.ewu@gmail.com",
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
