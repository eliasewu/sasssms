import { NextResponse } from "next/server";
import { trackLogout } from "@/lib/db-helpers";
import { hashToken, TENANT_ACCESS_COOKIE, TENANT_REFRESH_COOKIE } from "@/lib/auth";
import { revokeByAccessToken, revokeByRefreshToken, clearSessionCookies } from "@/lib/session-store";

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") || "";

  // Revoke the live session so the access token is rejected on the next
  // request (immediate invalidation) and the refresh token can't mint new ones.
  const accessMatch = cookie.match(new RegExp(`${TENANT_ACCESS_COOKIE}=([^;]+)`));
  if (accessMatch) {
    await trackLogout(hashToken(accessMatch[1])).catch(() => {});
    await revokeByAccessToken(accessMatch[1]);
  }

  const refreshMatch = cookie.match(new RegExp(`${TENANT_REFRESH_COOKIE}=([^;]+)`));
  if (refreshMatch) {
    await revokeByRefreshToken(refreshMatch[1]);
  }

  const response = NextResponse.json({ success: true, message: "Logged out" });
  clearSessionCookies(response, "tenant");
  return response;
}
