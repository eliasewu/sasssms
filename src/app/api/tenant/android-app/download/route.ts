import { NextResponse } from "next/server";
import { readFileSync, statSync } from "fs";
import { getTenantFromRequest, verifyToken } from "@/lib/auth";
import type { TenantToken } from "@/lib/auth";

const APK_PATH = "/opt/net2app/android-app/net2app-v1.0.0.apk";

export async function GET(request: Request) {
  // Auth check — must be logged in as a tenant.
  // Supports three modes:
  //   1. Standard tenant_token cookie (browser) — handled by getTenantFromRequest
  //   2. Authorization: Bearer <jwt> header (Android app) — handled by getTenantFromRequest
  //   3. ?token=<jwt> query parameter (shared links) — handled below
  let tenant: TenantToken | null = getTenantFromRequest(request);

  if (!tenant) {
    // Try query param ?token=<jwt>
    const url = new URL(request.url);
    const queryToken = url.searchParams.get("token");
    if (queryToken) {
      const payload = verifyToken(queryToken);
      if (payload && "tenantId" in payload) {
        tenant = payload as TenantToken;
      }
    }
  }

  if (!tenant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = statSync(APK_PATH);
    const fileBuffer = readFileSync(APK_PATH);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Length": stats.size.toString(),
        "Content-Disposition": 'attachment; filename="net2app-v1.0.0.apk"',
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "APK file not found on server" },
      { status: 404 }
    );
  }
}
