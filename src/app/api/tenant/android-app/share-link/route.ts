import { NextResponse } from "next/server";
import { getTenantFromRequest, createNonExpiringToken } from "@/lib/auth";

/**
 * GET /api/tenant/android-app/share-link
 *
 * Returns a shareable APK download URL that includes a JWT token query param.
 * This lets users copy-paste the link to their Android phone to download the
 * APK without needing to log in from the phone browser.
 *
 * The token is intentionally non-expiring so the QR code / link continues
 * to work indefinitely for long-running Android gateway devices.
 */
export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate a fresh non-expiring token for the download link
  const nonExpiringToken = createNonExpiringToken({
    tenantId: tenant.tenantId,
    email: tenant.email,
    schemaName: tenant.schemaName,
    companyName: tenant.companyName,
  });

  // Use the Host header so the URL works externally (not localhost:5556)
  const host = request.headers.get("host") || "net2app.com";
  const protocol = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;
  const downloadUrl = `${baseUrl}/api/tenant/android-app/download?token=${encodeURIComponent(nonExpiringToken)}`;

  return NextResponse.json({
    downloadUrl,
    expiresIn: "Never expires",
  });
}
