/**
 * Next.js 16 Proxy (the middleware file convention, renamed in v16).
 *
 * Runs on the Node.js runtime by default. Records real per-tenant API load
 * (request count + latency per endpoint) into `tenant_api_usage` for the
 * super admin's per-tenant CPU/RAM/storage view.
 *
 * Why here: all tenants share one process, so OS-level CPU/RAM can't be
 * attributed per tenant — but we CAN measure exactly which tenant is driving
 * API traffic, and how heavy each request is. That load share is the honest
 * per-tenant CPU/RAM signal; storage is measured per tenant schema separately.
 *
 * Performance: the DB write is deferred with event.waitUntil() so it never
 * adds latency to the tenant request, and the recorder never rejects.
 *
 * Only /api/tenant/* (JWT-authenticated tenant API) is tracked — streaming
 * routes and file downloads are skipped so the response is never buffered.
 */
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { recordTenantApiUsage } from "@/lib/tenant-usage";

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Never buffer long-lived/streaming or large-file responses.
  if (pathname.includes("/stream") || pathname.includes("/android-app/download")) {
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
  matcher: ["/api/tenant/:path*"],
};
