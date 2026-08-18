import { NextResponse } from "next/server";
import { pool } from "@/db";
import {
  createToken,
  generateRefreshToken,
  ACCESS_COOKIE_MAX_AGE,
  TENANT_REFRESH_COOKIE,
} from "@/lib/auth";
import {
  lookupRefreshSession,
  rotateRefreshSession,
  revokeByRefreshToken,
  setSessionCookies,
} from "@/lib/session-store";

/**
 * POST /api/auth/refresh
 *
 * Exchanges a valid refresh token for a fresh short-lived access token + a
 * rotated (single-use) refresh token, so the user "stays logged in" without
 * re-entering their password. Accepts the refresh token via the
 * `tenant_refresh` cookie (browser) or `{ refreshToken }` body (Android app).
 */
export async function POST(request: Request) {
  try {
    let rawRefresh: string | null = null;
    const cookie = request.headers.get("cookie") || "";
    const m = cookie.match(new RegExp(`${TENANT_REFRESH_COOKIE}=([^;]+)`));
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
    if (!session || session.userType !== "tenant") {
      return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
    }

    // Re-fetch tenant so the new access token carries current schema/company
    // and we can reject suspended accounts.
    const { rows } = await pool.query(
      `SELECT id, email, schema_name, company_name, is_active FROM tenants WHERE id = $1 LIMIT 1`,
      [session.userId]
    );
    if (!rows.length || !rows[0].is_active) {
      await revokeByRefreshToken(rawRefresh);
      return NextResponse.json({ error: "Account unavailable" }, { status: 403 });
    }
    const tenant = rows[0];

    const newAccessToken = createToken({
      tenantId: tenant.id,
      email: tenant.email,
      schemaName: tenant.schema_name,
      companyName: tenant.company_name,
    });
    const newRefreshToken = generateRefreshToken();

    // Atomic single-use rotation — rejects replays and concurrent duplicates.
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
    setSessionCookies(response, "tenant", newAccessToken, newRefreshToken);
    return response;
  } catch (e: unknown) {
    console.error("Refresh error:", e);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
