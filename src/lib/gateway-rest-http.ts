/**
 * Shared helpers for the public gateway REST endpoints
 * (/api/public/gateway/*). Handles per-IP rate limiting and supplier
 * credential authentication (username + password on every call).
 */
import { NextResponse } from "next/server";
import {
  authenticateGateway,
  authenticateGatewayByApiKey,
  GatewayAuthResult,
} from "./gateway-rest-auth";
import { recordTenantApiUsage } from "./tenant-usage";

const RATE_MAX = 300; // per IP per minute (a gateway polls ~25/min)
const RATE_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (!v.some((t) => now - t < RATE_WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

export function gatewayCorsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function gatewayJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: gatewayCorsHeaders() });
}

export async function gatewayOptions(): Promise<NextResponse> {
  return gatewayJson({}, 204);
}

/**
 * Rate-limit + authenticate a gateway request. On any failure, returns
 * `response` (already built); otherwise `auth` is the validated supplier.
 */
export interface GatewayRequestResult {
  auth: GatewayAuthResult | null;
  /** Built error response when auth/rate-limit failed */
  response?: NextResponse;
  /** Parsed JSON body (already consumed) */
  body?: Record<string, unknown>;
}

export async function authenticateGatewayRequest(
  request: Request
): Promise<GatewayRequestResult> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip)) {
    return {
      auth: null,
      response: gatewayJson({ error: "Too many requests — slow down" }, 429),
    };
  }

  let body: Record<string, unknown> | null = null;
  try {
    body = await request.json();
  } catch {}

  // Long-running gateways authenticate with a stable device API key (issued on
  // register) so the supplier password is never sent on every poll/heartbeat.
  // Username + password remains supported for first registration/back-compat.
  const apiKey = body && typeof body.apiKey === "string" ? body.apiKey.trim() : "";

  let auth: GatewayAuthResult | null = null;
  if (apiKey) {
    auth = await authenticateGatewayByApiKey(apiKey);
    if (!auth) {
      return {
        auth: null,
        response: gatewayJson({ error: "Invalid gateway API key" }, 401),
      };
    }
  } else {
    if (
      !body ||
      typeof body.username !== "string" ||
      typeof body.password !== "string"
    ) {
      return {
        auth: null,
        response: gatewayJson({ error: "username and password (or apiKey) required" }, 400),
      };
    }

    auth = await authenticateGateway(body.username, body.password);
    if (!auth) {
      return {
        auth: null,
        response: gatewayJson({ error: "Invalid supplier credentials" }, 401),
      };
    }
  }
  return { auth, body: body ?? {} };
}

/**
 * Run a gateway route handler while recording its per-tenant API load
 * (count + real latency) into tenant_api_usage. Fire-and-forget — the record
 * write never blocks or fails the handler. Used by every /api/public/gateway/*
 * route so Android gateway traffic (the heaviest per-tenant load) shows up in
 * the super admin's per-tenant usage columns alongside /api/tenant/* traffic.
 */
export async function withGatewayUsage<T>(
  auth: GatewayAuthResult,
  path: string,
  handler: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    return await handler();
  } finally {
    const durationMs = performance.now() - start;
    // Not awaited — the recorder catches its own errors and must not delay the
    // response. The gateway polls every ~3s, so this write is a tiny upsert.
    void recordTenantApiUsage({
      tenantId: auth.tenantId,
      schemaName: auth.schemaName,
      path,
      method: "POST",
      durationMs,
    });
  }
}
