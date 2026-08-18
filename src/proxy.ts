/**
 * Next.js 16 Proxy (the middleware file convention, renamed in v16).
 *
 * Runs on the Node.js runtime by default. Does two things:
 *
 * 1. IMMEDIATE LOGOUT REVOCATION — every /api/tenant/* and /api/super/*
 *    request is checked against `auth_sessions`. If the presented access
 *    token belongs to a revoked session (logout), the request is rejected
 *    before the route runs. This is what makes "after logout the token stops
 *    working" true on the very next request, and it bounds the MITM/replay
 *    window to the 15-minute access TTL even if a token is stolen.
 *
 * 2. Per-tenant API load recording (request count + latency per endpoint) into
 *    `tenant_api_usage` for the super admin's per-tenant CPU/RAM/storage view.
 *
 * Performance: the revocation lookup is a single indexed SELECT and fails
 * OPEN on a transient DB error (a valid user is never locked out); the usage
 * write is deferred with event.waitUntil() so it never adds request latency.
 */
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { getTenantFromRequest, extractRawAccessToken } from "@/lib/auth";
import { isAccessTokenRevoked } from "@/lib/session-store";
import { recordTenantApiUsage } from "@/lib/tenant-usage";

// Paths that REQUIRE authentication. Only these may be 401'd by the
// revocation check — public endpoints (/api/public/*, login, register,
// google, forgot-password…) must stay reachable even when the browser still
// carries an old/revoked session cookie, otherwise the landing page's
// /api/public/settings + /api/public/health requests would 401 and the page
// would show the error boundary instead of content.
export const AUTH_REQUIRED_PATH_PREFIXES = [
  "/api/tenant/",
  "/api/super/",
  "/api/auth/me",
  "/api/auth/logout",
  "/api/auth/refresh",
];

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ── Immediate logout revocation (authenticated endpoints only) ──
  const rawToken = extractRawAccessToken(request);
  if (rawToken && AUTH_REQUIRED_PATH_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (await isAccessTokenRevoked(rawToken)) {
      return NextResponse.json(
        { error: "Session ended. Please log in again." },
        { status: 401 }
      );
    }
  }

  // Never buffer long-lived/streaming or large-file responses.
  if (pathname.includes("/stream") || pathname.includes("/android-app/download")) {
    return NextResponse.next();
  }

  // Usage tracking is tenant-only (the super admin isn't metered per-tenant).
  if (!pathname.startsWith("/api/tenant/")) {
    return NextResponse.next();
  }

  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.next();

  const start = performance.now();
  const response = await NextResponse.next();
  const durationMs = performance.now() - start;

  // Fire-and-forget: the write runs after the response is sent, never blocking.
  event.waitUntil(
    recordTenantApiUsage({
      tenantId: tenant.tenantId,
      schemaName: tenant.schemaName,
      path: pathname,
      method,
      durationMs,
    })
  );

  return response;
}

export const config = {
  // Match every API route so the immediate-logout revocation check also covers
  // authenticated endpoints outside /api/tenant and /api/super (e.g. /api/auth/me,
  // /api/mcc-mnc). The check is a no-op when no access token is present, so
  // public endpoints (/api/public/*, login/register) are unaffected.
  matcher: ["/api/:path*"],
};
