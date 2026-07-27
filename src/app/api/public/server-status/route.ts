/**
 * Public Server Status API — No auth required
 * GET /api/public/server-status
 *
 * Returns all active server locations with lightweight health status.
 * IP addresses and ports are REDACTED for security — never exposed publicly.
 */

import { NextResponse } from "next/server";
import { checkAllServers, ServerInfo, HEALTH_CHECK_INTERVAL_MS } from "@/lib/server-health";

// Simple in-memory cache
let cache: { data: ServerInfo[]; timestamp: number } | null = null;
const CACHE_TTL = HEALTH_CHECK_INTERVAL_MS;

/** Strip sensitive fields (IP, port) from server objects before public exposure */
function sanitize(servers: ServerInfo[]): ServerInfo[] {
  return servers.map(s => ({ ...s, ipAddress: "", port: 0 }));
}

export async function GET() {
  // Return cached response if fresh
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(
      {
        servers: sanitize(cache.data),
        cached: true,
        nextUpdate: new Date(cache.timestamp + CACHE_TTL).toISOString(),
      },
      { headers: { "Cache-Control": "public, max-age=30" } }
    );
  }

  try {
    const servers = await checkAllServers();

    cache = { data: servers, timestamp: Date.now() };

    return NextResponse.json(
      {
        servers: sanitize(servers),
        cached: false,
        nextUpdate: new Date(Date.now() + CACHE_TTL).toISOString(),
      },
      { headers: { "Cache-Control": "public, max-age=30" } }
    );
  } catch (err) {
    console.error("[ServerStatus] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch server status", servers: [] },
      { status: 500 }
    );
  }
}
