import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";

/**
 * GET /api/tenant/android-app/share-link
 *
 * Returns a shareable APK download URL that includes a JWT token query param.
 * This lets users copy-paste the link to their Android phone to download the
 * APK without needing to log in from the phone browser.
 */
export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Extract the JWT from the tenant_token cookie
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(/tenant_token=([^;]+)/);
  const jwtToken = m ? m[1] : null;

  if (!jwtToken) {
    return NextResponse.json(
      { error: "No tenant token found" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;
  const downloadUrl = `${baseUrl}/api/tenant/android-app/download?token=${encodeURIComponent(jwtToken)}`;

  return NextResponse.json({
    downloadUrl,
    expiresIn: "30 days (matches session token lifetime)",
  });
}
