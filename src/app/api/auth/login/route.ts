import { NextResponse } from "next/server";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { verifyPassword, createToken, generateRefreshToken, ACCESS_COOKIE_MAX_AGE } from "@/lib/auth";
import { createAuthSession, setSessionCookies } from "@/lib/session-store";
import { trackLogin } from "@/lib/db-helpers";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { authLimiter, loginGuard, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // Rate limit: 10 attempts per IP per minute
    const clientIp = getClientIp(request);
    if (authLimiter.check(clientIp)) {
      return NextResponse.json({ error: "Too many login attempts. Please try again in a minute." }, { status: 429 });
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Brute-force lockout: 5 consecutive failures → 15 min block (per account)
    const lockedMs = loginGuard.lockedMs(normalizedEmail);
    if (lockedMs > 0) {
      const retryAfter = Math.ceil(lockedMs / 1000);
      return NextResponse.json(
        {
          error: `Too many failed login attempts. Account temporarily locked. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        }
      );
    }

    const [tenant] = await db.select().from(tenants).where(eq(tenants.email, normalizedEmail));
    
    if (!tenant) {
      // Count as a failure too — an attacker probing unknown accounts must
      // not be able to distinguish them from real ones via lockout behavior.
      const res = loginGuard.registerFailure(normalizedEmail);
      if (res.remaining === 0) {
        return NextResponse.json({ error: "Too many failed login attempts. Account temporarily locked. Try again in 15 minutes." }, { status: 429 });
      }
      return NextResponse.json({ error: "Invalid credentials. Account not found." }, { status: 401 });
    }

    const valid = await verifyPassword(password, tenant.passwordHash);
    if (!valid) {
      const res = loginGuard.registerFailure(normalizedEmail);
      if (res.remaining === 0) {
        const retryAfter = Math.ceil(res.lockedMs / 1000);
        return NextResponse.json(
          {
            error: `Too many failed login attempts. Account temporarily locked. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
          },
          {
            status: 429,
            headers: { "Retry-After": String(retryAfter) },
          }
        );
      }
      return NextResponse.json({ error: "Invalid credentials. Please check your password." }, { status: 401 });
    }

    // Successful login — clear any prior failure streak
    loginGuard.reset(normalizedEmail);

    if (!tenant.isActive) {
      return NextResponse.json({ error: "Account suspended. Contact support." }, { status: 403 });
    }

    const token = createToken({
      tenantId: tenant.id,
      email: tenant.email,
      schemaName: tenant.schemaName,
      companyName: tenant.companyName,
    });
    const refreshToken = generateRefreshToken();

    // Track login session (audit trail)
    const sessionIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "127.0.0.1";
    const ua = request.headers.get("user-agent") || "";
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await trackLogin("tenant", tenant.id, tenant.email, sessionIp, ua, tokenHash);

    // Persist the live session (access + refresh) for revocation/refresh
    await createAuthSession({
      userType: "tenant",
      userId: tenant.id,
      email: tenant.email,
      accessToken: token,
      refreshToken,
    });

    const response = NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        companyName: tenant.companyName,
        email: tenant.email,
      },
      token,
      refreshToken, // for non-browser clients (Android app) that manage their own cookies
      expiresIn: ACCESS_COOKIE_MAX_AGE,
    });

    setSessionCookies(response, "tenant", token, refreshToken);

    return response;
  } catch (error: unknown) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed due to server error" }, { status: 500 });
  }
}
