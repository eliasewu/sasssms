/**
 * Shared server health utilities — used by both the REST API and SSE stream.
 */

import { pool } from "@/db";
import net from "net";

export interface ServerInfo {
  id: string;
  country: string;
  city: string;
  countryCodes: string;
  ipAddress: string;
  port: number;
  isActive: boolean;
  status: "online" | "offline" | "unknown";
  lastChecked: string;
}

export const HEALTH_CHECK_INTERVAL_MS = 30_000;

/** Resolve this server's own public IP (cached after first call). */
let selfPublicIp: string | null | undefined;
async function getSelfPublicIp(): Promise<string | null> {
  if (selfPublicIp !== undefined) return selfPublicIp;
  try {
    const res = await fetch("https://ifconfig.me/ip", { signal: AbortSignal.timeout(3000) });
    selfPublicIp = (await res.text()).trim();
  } catch {
    selfPublicIp = null;
  }
  return selfPublicIp;
}

export async function tcpCheck(ip: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3000);
    socket.on("connect", () => { socket.destroy(); resolve(true); });
    socket.on("error", () => { socket.destroy(); resolve(false); });
    socket.on("timeout", () => { socket.destroy(); resolve(false); });
    socket.connect(port, ip);
  });
}

export async function checkAllServers(): Promise<ServerInfo[]> {
  const client = await pool.connect();
  let locations: any[] = [];
  try {
    const { rows } = await client.query(
      "SELECT value FROM platform_settings WHERE key = 'server_locations'"
    );
    if (rows.length > 0) {
      try { locations = JSON.parse(rows[0].value || "[]"); } catch { locations = []; }
    }
  } finally {
    client.release();
  }

  const activeLocations = locations.filter((l: any) => l.isActive);

  return Promise.all(
    activeLocations.map(async (loc: any) => {
      const hasIp = loc.ipAddress && loc.ipAddress !== "";
      let status: ServerInfo["status"] = "unknown";
      if (hasIp) {
        // Try the configured IP first
        let isReachable = await tcpCheck(loc.ipAddress, loc.port || 2775);
        // If it fails and the IP matches this server's own public IP, try localhost
        // (handles hairpin/NAT where a server can't connect to its own public IP)
        if (!isReachable) {
          const myIp = await getSelfPublicIp();
          if (myIp && myIp === loc.ipAddress) {
            isReachable = await tcpCheck("127.0.0.1", loc.port || 2775);
          }
        }
        status = isReachable ? "online" : "offline";
      }
      return {
        id: loc.id,
        country: loc.country || "",
        city: loc.city || "",
        countryCodes: loc.countryCodes || "",
        ipAddress: hasIp ? loc.ipAddress : "",
        port: loc.port || 2775,
        isActive: loc.isActive === true,
        status,
        lastChecked: new Date().toISOString(),
      };
    })
  );
}
