import { NextResponse } from "next/server";
import { verifyProxyRegisterToken } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

// ═══════════════════════════════════════════════════════════════════════
//  Auto-registration endpoint used by the per-tenant 3proxy installer
//  scripts (Linux .sh / Windows .bat downloaded from
//  /api/tenant/proxy-config/download).
//
//  The installer runs on the residential machine, starts 3proxy, then
//  POSTs its Tailscale IP here. The registration token was minted by the
//  download route and is the source of truth for tenant + credentials:
//  the script can only supply the host it is actually running on, never
//  the username/password (those travel inside the signed 30-min token).
//
//  POST { token, host, name? }
// ═══════════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const token = verifyProxyRegisterToken(String(body.token || ""));
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Invalid or expired registration token" },
      { status: 401 }
    );
  }

  const host = String(body.host || "").trim();
  // Legitimate values are Tailscale IPv4/IPv6 addresses (or hostnames). Reject
  // garbage — a hostile/oversized host could otherwise clobber an existing
  // (host, port) row during the upsert.
  const HOST_RE = /^(\d{1,3}(\.\d{1,3}){3}|[0-9a-fA-F:]+|[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*)$/;
  if (!host || host.length > 255 || !HOST_RE.test(host)) {
    return NextResponse.json(
      { ok: false, error: "host must be a valid IP address or hostname" },
      { status: 400 }
    );
  }

  const name = String(body.name || "Home 3proxy (auto)").slice(0, 255);

  try {
    // Upsert on (host, port) — re-running an installer updates the row
    // instead of creating duplicates.
    const existing = await tenantQuery(
      token.schemaName,
      "SELECT id FROM proxy_config WHERE host = $1 AND port = $2",
      [host, token.port]
    );

    if (existing.rows.length > 0) {
      await tenantQuery(
        token.schemaName,
        `UPDATE proxy_config
         SET username = $1, password = $2, protocol = 'socks5',
             proxy_type = 'residential', name = $3, is_active = true
         WHERE id = $4`,
        [token.username, token.password, name, existing.rows[0].id]
      );
    } else {
      await tenantQuery(
        token.schemaName,
        `INSERT INTO proxy_config (name, proxy_type, host, port, username, password, protocol)
         VALUES ($1, 'residential', $2, $3, $4, $5, 'socks5')`,
        [name, host, token.port, token.username, token.password]
      );
    }

    return NextResponse.json({ ok: true, host, port: token.port });
  } catch (e) {
    console.error("Proxy auto-register error:", e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
