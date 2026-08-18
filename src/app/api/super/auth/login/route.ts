import { NextResponse } from "next/server";
import { db } from "@/db";
import { superAdmins } from "@/db/schema";
import { verifyPassword, createToken, generateRefreshToken, ACCESS_COOKIE_MAX_AGE } from "@/lib/auth";
import { createAuthSession, setSessionCookies } from "@/lib/session-store";
import { eq } from "drizzle-orm";
import { authLimiter, superLoginGuard, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    // Rate limit: 10 attempts per IP per minute
    const ip = getClientIp(request);
    if (authLimiter.check(ip)) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Brute-force lockout: 5 consecutive failures → 15 min block (per account)
    const lockedMs = superLoginGuard.lockedMs(normalizedEmail);
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

    const [admin] = await db.select().from(superAdmins).where(eq(superAdmins.email, normalizedEmail));
    if (!admin) {
      const res = superLoginGuard.registerFailure(normalizedEmail);
      if (res.remaining === 0) {
        return NextResponse.json({ error: "Too many failed login attempts. Account temporarily locked. Try again in 15 minutes." }, { status: 429 });
      }
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid) {
      const res = superLoginGuard.registerFailure(normalizedEmail);
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
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Successful login — clear any prior failure streak
    superLoginGuard.reset(normalizedEmail);

    if (!admin.isActive) {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }

    const token = createToken({
      adminId: admin.id,
      email: admin.email,
      isSuper: true,
    });
    const refreshToken = generateRefreshToken();

    await createAuthSession({
      userType: "super",
      userId: admin.id,
      email: admin.email,
      accessToken: token,
      refreshToken,
    });

    const response = NextResponse.json({
      success: true,
      admin: { id: admin.id, name: admin.name, email: admin.email },
      token,
      refreshToken,
      expiresIn: ACCESS_COOKIE_MAX_AGE,
    });

    setSessionCookies(response, "super", token, refreshToken);

    return response;
  } catch (error: unknown) {
    console.error("Super admin login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
