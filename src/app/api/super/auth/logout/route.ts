import { NextResponse } from "next/server";
import { SUPER_ACCESS_COOKIE, SUPER_REFRESH_COOKIE } from "@/lib/auth";
import { revokeByAccessToken, revokeByRefreshToken, clearSessionCookies } from "@/lib/session-store";

export async function POST(request: Request) {
  const cookie = request.headers.get("cookie") || "";

  const accessMatch = cookie.match(new RegExp(`${SUPER_ACCESS_COOKIE}=([^;]+)`));
  if (accessMatch) {
    await revokeByAccessToken(accessMatch[1]);
  }

  const refreshMatch = cookie.match(new RegExp(`${SUPER_REFRESH_COOKIE}=([^;]+)`));
  if (refreshMatch) {
    await revokeByRefreshToken(refreshMatch[1]);
  }

  const response = NextResponse.json({ success: true });
  clearSessionCookies(response, "super");
  return response;
}
