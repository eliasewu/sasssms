import { NextResponse } from "next/server";
import { pool } from "@/db";
import {
  createToken,
  generateRefreshToken,
  ACCESS_COOKIE_MAX_AGE,
  SUPER_REFRESH_COOKIE,
} from "@/lib/auth";
import {
  lookupRefreshSession,
  rotateRefreshSession,
  revokeByRefreshToken,
  setSessionCookies,
} from "@/lib/session-store";

/**
 * POST /api/super/auth/refresh
 *
 * Same refresh/rotation flow as the tenant endpoint, for super admin sessions.
 */
export async function POST(request: Request) {
  try {
    let rawRefresh: string | null = null;
    const cookie = request.headers.get("cookie") || "";
    const m = cookie.match(new RegExp(`${SUPER_REFRESH_COOKIE}=([^;]+)`));
    if (m && m[1]) rawRefresh = m[1];

    if (!rawRefresh) {
      try {
        const body = await request.json();
        if (body && typeof body.refreshToken === "string") rawRefresh = body.refreshToken;
      } catch {
        /* no JSON body */
      }
    }

    if (!rawRefresh) {
      return NextResponse.json({ error: "No refresh token" }, { status: 401 });
    }

    const session = await lookupRefreshSession(rawRefresh);
    if (!session || session.userType !== "super") {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    const { rows } = await pool.query(
      `SELECT id, email, is_active FROM super_admins WHERE id = $1 LIMIT 1`,
      [session.userId]
    );
    if (!rows.length || !rows[0].is_active) {
      await revokeByRefreshToken(rawRefresh);
      return NextResponse.json({ error: "Account unavailable" }, { status: 403 });
    }
    const admin = rows[0];

    const newAccessToken = createToken({
      adminId: admin.id,
      email: admin.email,
      isSuper: true,
    });
    const newRefreshToken = generateRefreshToken();

    const rotated = await rotateRefreshSession({
      rawRefreshToken: rawRefresh,
      newAccessToken,
      newRefreshToken,
    });
    if (!rotated) {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    const response = NextResponse.json({
      success: true,
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: ACCESS_COOKIE_MAX_AGE,
    });
    setSessionCookies(response, "super", newAccessToken, newRefreshToken);
    return response;
  } catch (e: unknown) {
    console.error("Super refresh error:", e);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
