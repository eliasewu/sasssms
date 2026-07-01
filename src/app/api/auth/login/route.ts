import { NextResponse } from "next/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { verifyPassword, createToken } from "@/lib/auth";
import { trackLogin } from "@/lib/db-helpers";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const [tenant] = await db.select().from(tenants).where(eq(tenants.email, normalizedEmail));
    
    if (!tenant) {
      return NextResponse.json({ error: "Invalid credentials. Account not found." }, { status: 401 });
    }

    const valid = await verifyPassword(password, tenant.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials. Please check your password." }, { status: 401 });
    }

    if (!tenant.isActive) {
      return NextResponse.json({ error: "Account suspended. Contact support." }, { status: 403 });
    }

    const token = createToken({
      tenantId: tenant.id,
      email: tenant.email,
      schemaName: tenant.schemaName,
      companyName: tenant.companyName,
    });

    // Track login session
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
    const ua = request.headers.get("user-agent") || "";
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await trackLogin("tenant", tenant.id, tenant.email, ip, ua, tokenHash);

    const response = NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        companyName: tenant.companyName,
        email: tenant.email,
      },
      token,
    });

    // Set cookie with proper settings
    response.cookies.set("tenant_token", token, {
      httpOnly: true,
      secure: true, // HTTPS now enabled
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days (matches JWT expiry)
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed due to server error" }, { status: 500 });
  }
}
