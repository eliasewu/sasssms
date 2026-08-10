import { NextResponse } from "next/server";
import { execFile } from "child_process";
import net from "net";
import { getTenantFromRequest } from "@/lib/auth";
import { pool } from "@/db";
import { tenantQuery } from "@/lib/tenant-schema";

// ═══════════════════════════════════════════════════════════════════════
//  Tailscale mesh status for the tenant dashboard.
//
//  Reports:
//    • this server's Tailscale identity (Self from `tailscale status --json`)
//    • only the mesh peers that host THIS tenant's proxies (the server-wide
//      peer list is never exposed to tenants — multi-tenant privacy)
//    • live "server → proxy" reachability for the tenant's proxy_config rows
//      (plain TCP connect to host:port over the mesh — fast, no auth needed)
//
//  The server itself must be joined to the same tailnet as the residential
//  machines (install: `curl -fsSL https://tailscale.com/install.sh | sh`).
//
//  GET /api/tenant/tailscale/status
// ═══════════════════════════════════════════════════════════════════════

// Short in-memory cache so tenants can't hammer `tailscale status --json`
// (shells out) + N socket probes on every panel mount/refresh.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { at: number; body: unknown }>();

interface TailscalePeer {
  HostName?: string;
  DNSName?: string;
  TailscaleIPs?: string[];
  OS?: string;
  Online?: boolean;
  LastSeen?: string;
}

function runTailscale(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("tailscale", args, { timeout: 8000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

/** Fast TCP reachability probe (2.5s cap). One bad row must never blank the rest. */
function probe(host: string, port: number): Promise<boolean> {
  if (!host || !Number.isFinite(port) || port < 1 || port > 65535) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 2500 });
    socket.setTimeout(2500);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
    socket.once("error", () => resolve(false));
  });
}

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Serve from cache (keyed per tenant schema) when fresh.
  const cached = cache.get(tenant.schemaName);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.body);
  }

  // ── 0. Auto-connect auth key configured? (presence only — never the value) ──
  let authKeyConfigured = false;
  try {
    const keyRes = await pool.query("SELECT value FROM platform_settings WHERE key = 'tailscaleAuthKey'");
    authKeyConfigured = !!(keyRes.rows.length > 0 && keyRes.rows[0].value);
  } catch { /* not configured */ }

  // ── 1. Tailscale status ──
  let status: { Self?: TailscalePeer & { TailscaleIPs?: string[] }; Peer?: Record<string, TailscalePeer> };
  try {
    const out = await runTailscale(["status", "--json"]);
    status = JSON.parse(out);
  } catch {
    // Binary missing, not logged in, or daemon down — report which one.
    let notInstalled = false;
    try { await runTailscale(["--version"]); } catch { notInstalled = true; }
    return NextResponse.json({
      available: false,
      reason: notInstalled ? "not_installed" : "not_connected",
      authKeyConfigured,
    });
  }

  const serverIp = status.Self?.TailscaleIPs?.find((ip) => !ip.includes(":")) || status.Self?.TailscaleIPs?.[0] || "";
  const server = status.Self
    ? {
        name: (status.Self.HostName || "").replace(/\.$/, ""),
        dnsName: (status.Self.DNSName || "").replace(/\.$/, ""),
        ip: serverIp,
        os: status.Self.OS || "unknown",
      }
    : null;

  // ── 2. Live reachability for this tenant's proxies ──
  let proxies: { id: number; name: string; host: string; port: number; reachable: boolean }[] = [];
  try {
    const res = await tenantQuery(
      tenant.schemaName,
      "SELECT id, name, host, port, is_active FROM proxy_config ORDER BY id DESC"
    );
    const rows = res.rows as { id: number; name: string; host: string; port: number; is_active: boolean }[];
    proxies = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        name: r.name,
        host: r.host,
        port: Number(r.port),
        // Isolate each probe — a malformed row resolves false, never rejects.
        reachable: await probe(r.host, Number(r.port)).catch(() => false),
      }))
    );
  } catch {
    // tenantQuery failed (schema missing) — proxies section stays empty.
  }

  // ── 3. Peers — only the ones that host THIS tenant's proxies. The
  //    server-wide peer list is infrastructure shared by every tenant and
  //    must never leak through a tenant-authed endpoint.
  const proxyHosts = new Set(proxies.map((p) => p.host));
  const peers = Object.values(status.Peer || {})
    .filter((p) => (p.TailscaleIPs || []).some((ip) => proxyHosts.has(ip)))
    .map((p) => ({
      name: (p.HostName || "").replace(/\.$/, "") || (p.DNSName || "").split(".")[0] || "unknown",
      dnsName: (p.DNSName || "").replace(/\.$/, ""),
      ip: p.TailscaleIPs?.find((ip) => !ip.includes(":")) || p.TailscaleIPs?.[0] || "",
      os: p.OS || "unknown",
      online: p.Online === true,
    }))
    .sort((a, b) => (a.online === b.online ? a.name.localeCompare(b.name) : a.online ? -1 : 1));

  const body = {
    available: true,
    server,
    peers,
    proxies,
    authKeyConfigured,
    checkedAt: new Date().toISOString(),
  };
  cache.set(tenant.schemaName, { at: Date.now(), body });
  return NextResponse.json(body);
}
