/**
 * Public Health Check — designed for external monitors (UptimeRobot, Pingdom, etc.)
 * GET /api/public/health
 *
 * Returns HTTP 200 when the platform is healthy (≤1 server offline).
 * Returns HTTP 503 when degraded (>1 server offline for deployed locations).
 *
 * UptimeRobot can monitor this endpoint and alert after N minutes of consecutive
 * failures, implementing the "offline >5 minutes" threshold without server-side state.
 */

import { NextResponse } from "next/server";
import { checkAllServers, HEALTH_CHECK_INTERVAL_MS } from "@/lib/server-health";
import { exec } from "child_process";

async function getPm2Status(): Promise<{ online: boolean; processCount: number; error?: string }> {
  return new Promise((resolve) => {
    exec("pm2 jlist 2>/dev/null", { timeout: 5000, encoding: "utf-8" }, (err, stdout) => {
      if (err) {
        resolve({ online: false, processCount: 0, error: err.message });
        return;
      }
      try {
        const list = JSON.parse(stdout);
        const onlineCount = list.filter((p: any) => p.pm2_env?.status === "online").length;
        resolve({ online: onlineCount > 0, processCount: list.length });
      } catch (parseErr: any) {
        resolve({ online: false, processCount: 0, error: parseErr.message });
      }
    });
  });
}

// Cache health result for 15s to avoid excessive DB/TCP load from frequent external pings
let cache: { result: any; timestamp: number } | null = null;
const CACHE_TTL = 15_000;

export async function GET() {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.result, { status: cache.result.statusCode });
  }

  try {
    const [servers, pm2] = await Promise.all([checkAllServers(), getPm2Status()]);

    const deployed = servers.filter((s) => s.ipAddress);

    // Edge case: no servers configured at all
    if (deployed.length === 0) {
      const result = {
        status: "no_servers",
        statusCode: 200,
        timestamp: new Date().toISOString(),
        summary: { total: 0, online: 0, offline: 0, unknown: 0 },
        pm2: { online: pm2.online, processCount: pm2.processCount },
        offlineServers: [] as any[],
        message: "No server locations configured yet — monitoring inactive",
      };
      cache = { result, timestamp: Date.now() };
      return NextResponse.json(result, { status: 200 });
    }

    const online = deployed.filter((s) => s.status === "online");
    const offline = deployed.filter((s) => s.status === "offline");
    const unknown = deployed.filter((s) => s.status === "unknown");

    // Healthy: ≤1 server offline
    // Degraded: 2+ servers offline → return 503 so UptimeRobot triggers alert
    const isDegraded = offline.length > 1;
    const statusCode = isDegraded ? 503 : 200;

    const result = {
      status: isDegraded ? "degraded" : "healthy",
      statusCode,
      timestamp: new Date().toISOString(),
      summary: {
        total: deployed.length,
        online: online.length,
        offline: offline.length,
        unknown: unknown.length,
      },
      pm2: { online: pm2.online, processCount: pm2.processCount },
      offlineServers: offline.map((s) => ({
        id: s.id,
        country: s.country,
        city: s.city,
        ipAddress: s.ipAddress,
      })),
      message: isDegraded
        ? `${offline.length} servers offline — investigation required`
        : `All systems healthy (${online.length}/${deployed.length} online)`,
    };

    cache = { result, timestamp: Date.now() };

    return NextResponse.json(result, { status: statusCode });
  } catch (err) {
    console.error("[Health] Error:", err);
    return NextResponse.json(
      { status: "error", message: "Health check failed internally" },
      { status: 500 }
    );
  }
}
