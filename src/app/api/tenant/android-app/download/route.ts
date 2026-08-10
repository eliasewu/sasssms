import { NextResponse } from "next/server";
import { createReadStream, statSync } from "fs";
import { Readable } from "stream";
import { getTenantFromRequest, verifyToken } from "@/lib/auth";
import type { TenantToken } from "@/lib/auth";
import { APK_PATH, APK_FILENAME } from "@/lib/apk-config";

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
    // Stream the file instead of buffering it in memory — the APK is ~65 MB,
    // so readFileSync would allocate a fresh buffer per download request.
    const stats = statSync(APK_PATH);
    // 1 MB highWaterMark: the APK is ~65 MB, so the default 64 KB chunk size
    // would mean ~1000 reads per download. Larger chunks cut syscall overhead
    // without buffering the whole file.
    const stream = Readable.toWeb(
      createReadStream(APK_PATH, { highWaterMark: 1024 * 1024 })
    ) as ReadableStream;

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Length": stats.size.toString(),
        "Content-Disposition": `attachment; filename="${APK_FILENAME}"`,
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
