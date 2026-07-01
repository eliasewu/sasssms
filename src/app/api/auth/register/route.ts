import { NextResponse } from "next/server";
import { db, pool } from "@/db";
import { tenants } from "@/db/schema";
import { hashPassword, createToken } from "@/lib/auth";
import { createTenantSchema } from "@/lib/tenant-schema";
import { eq } from "drizzle-orm";
import { safeInt, safeDecimal, safeText } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyName, email, phone, password } = body;

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
    let platformRate = "0.00030"; // fallback
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

    const [tenant] = await db.insert(tenants).values({
      companyName: safeText(companyName, 255),
      email: normalizedEmail,
      phone: safeText(phone, 50),
      passwordHash,
      schemaName,
      smppServerIp: "0.0.0.0",
      smppServerPort: 2775,
      costPerSms: safeDecimal(platformRate, "0.00025"),      // ← uses current platform rate
      smsLimit: 20,                                            // ← 20 free SMS for testing
      accountExpiresAt: expiresAt,
      emailVerified: true,
      phoneVerified: true,
    }).returning();

    // Create isolated tenant schema with all 27 tables
    await createTenantSchema(schemaName);

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
