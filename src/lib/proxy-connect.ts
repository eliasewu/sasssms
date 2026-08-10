/**
 * Proxy Connection Utilities
 *
 * Shared by the Business API send engine and the proxy-config "Test" endpoint.
 * Supports SOCKS5/SOCKS4 (via socks-proxy-agent) and HTTP/HTTPS (via
 * https-proxy-agent) — the same proxy_config rows used for OTT/WhatsApp/
 * Telegram and Business API routing.
 */
import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";

export interface ProxyConfigRow {
  host: string | null;
  port: number | null;
  protocol: string | null;
  username: string | null;
  password: string | null;
}

/**
 * Build the Node `agent` used by Baileys (WhatsApp OTT) so the WebSocket
 * connection egresses through the assigned residential proxy (3proxy +
 * Tailscale). Protocol-aware: SOCKS5/SOCKS4 → SocksProxyAgent,
 * HTTP/HTTPS → HttpsProxyAgent. Returns an empty object (no `agent` key —
 * callers destructure to `undefined`) when no proxy is usable or the protocol
 * is unsupported, so callers fall back to a direct connection.
 */
export function buildOttProxyAgent(
  proxy: ProxyConfigRow
): { agent?: unknown } {
  const raw = buildProxyUrl(proxy);
  if (!raw) return {};
  try {
    return { agent: buildProxyDispatcher(raw).dispatcher };
  } catch {
    console.warn(
      `[PROXY] OTT agent unusable for "${raw}" — connecting directly`
    );
    return {};
  }
}

/**
 * Build the `proxy` option passed to GramJS TelegramClient (Telegram OTT —
 * the Node equivalent of Telethon/Pyrogram). GramJS only accepts SOCKS
 * proxies (socksType 5 = SOCKS5, 4 = SOCKS4), so an HTTP/HTTPS proxy row is
 * downgraded to undefined (direct) with a warning.
 */
export function buildGramJsProxyConfig(
  proxy: ProxyConfigRow
): {
  ip: string;
  port: number;
  socksType: 5 | 4;
  username?: string;
  password?: string;
} | undefined {
  if (!proxy.host || !proxy.port) return undefined;
  const proto = (proxy.protocol || "socks5").toLowerCase();
  if (proto.includes("socks4")) {
    return {
      ip: proxy.host,
      port: proxy.port,
      socksType: 4,
      username: proxy.username || undefined,
      password: proxy.password || undefined,
    };
  }
  if (proto.includes("socks")) {
    return {
      ip: proxy.host,
      port: proxy.port,
      socksType: 5,
      username: proxy.username || undefined,
      password: proxy.password || undefined,
    };
  }
  // HTTP/HTTPS proxies aren't supported by GramJS's proxy option.
  console.warn(
    `[PROXY] GramJS only supports SOCKS proxies (got "${proto}") — Telegram will connect directly`
  );
  return undefined;
}

/**
 * Build a proxy URL from a proxy_config row. Supported schemes:
 * socks5/socks5h/socks4/socks4a/socks and http/https.
 * Returns null when the row has no usable host/port or an unsupported scheme.
 */
export function buildProxyUrl(proxy: ProxyConfigRow): string | null {
  if (!proxy.host || !proxy.port) return null;
  const proto = (proxy.protocol || "socks5").toLowerCase();
  const supported = new Set([
    "socks5",
    "socks5h",
    "socks4",
    "socks4a",
    "socks",
    "http",
    "https",
  ]);
  if (!supported.has(proto)) {
    console.warn(`[PROXY] Unsupported proxy protocol "${proto}"`);
    return null;
  }
  const auth =
    proxy.username && proxy.password
      ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@`
      : proxy.username
        ? `${encodeURIComponent(proxy.username)}@`
        : "";
  return `${proto}://${auth}${proxy.host}:${proxy.port}`;
}

/**
 * Build an undici `dispatcher` for the given proxy URL. Throws for unsupported
 * schemes so callers can degrade to a direct connection with a clean error.
 */
export function buildProxyDispatcher(
  rawProxyUrl: string | null
): { dispatcher?: unknown } {
  if (!rawProxyUrl) return {};
  const scheme = (rawProxyUrl.split("://")[0] || "").toLowerCase();
  if (["socks5", "socks5h", "socks4", "socks4a", "socks"].includes(scheme)) {
    return { dispatcher: new SocksProxyAgent(rawProxyUrl) };
  }
  if (scheme === "http" || scheme === "https") {
    return { dispatcher: new HttpsProxyAgent(rawProxyUrl) };
  }
  throw new Error(`Unsupported proxy scheme "${scheme}"`);
}

/**
 * Live connectivity test through a proxy_config row.
 *
 * Fetches a public "what is my IP" endpoint THROUGH the proxy and reports the
 * egress IP + round-trip latency. Used by the dashboard Test button so admins
 * can verify a 3proxy + Tailscale residential proxy actually works before
 * assigning it to OTT devices or Business API connections.
 *
 * Returns:
 *   ok        — connection + HTTP 200 through the proxy
 *   egressIp  — the public IP seen from behind the proxy (null on failure)
 *   latencyMs — round-trip time in ms (null on failure)
 *   error     — human-readable failure reason (null on success)
 */
export async function testProxyConnection(
  proxy: ProxyConfigRow,
  opts: { timeoutMs?: number } = {}
): Promise<{
  ok: boolean;
  egressIp: string | null;
  latencyMs: number | null;
  error: string | null;
}> {
  const timeoutMs = opts.timeoutMs || 12000;
  const rawProxyUrl = buildProxyUrl(proxy);
  if (!rawProxyUrl) {
    return {
      ok: false,
      egressIp: null,
      latencyMs: null,
      error: "Missing host/port or unsupported protocol — check the proxy row",
    };
  }

  let dispatcher: { dispatcher?: unknown } = {};
  try {
    dispatcher = buildProxyDispatcher(rawProxyUrl);
  } catch (err) {
    return {
      ok: false,
      egressIp: null,
      latencyMs: null,
      error: (err as Error).message,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    // Same pattern as the Business API send engine: spread the dispatcher so
    // undici routes the request through the proxy (Node fetch + undici).
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: controller.signal,
      ...dispatcher,
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return {
        ok: false,
        egressIp: null,
        latencyMs,
        error: `Proxy reachable but egress check returned HTTP ${res.status}`,
      };
    }
    const body = (await res.json()) as { ip?: string };
    if (!body.ip) {
      return {
        ok: false,
        egressIp: null,
        latencyMs,
        error: "Egress check returned no IP",
      };
    }

    // ── False-pass guard ──
    // If the proxy dispatcher was silently ignored (e.g. a fetch wrapper that
    // drops the undici option), the request went DIRECT and the "egress IP"
    // would be the datacenter's own IP. Compare against a direct request and
    // fail loudly when they match, so a broken proxy can't look healthy.
    let directIp: string | null = null;
    try {
      const direct = await fetch("https://api.ipify.org?format=json", {
        signal: AbortSignal.timeout(8000),
      });
      if (direct.ok) directIp = ((await direct.json()) as { ip?: string }).ip || null;
    } catch {
      // Direct check unavailable (offline or blocked) — skip the guard.
    }
    if (directIp && directIp === body.ip) {
      return {
        ok: false,
        egressIp: body.ip,
        latencyMs,
        error:
          "Egress IP matches the server's direct IP — the request did NOT traverse the proxy. Check that the proxy host is reachable from this server and the protocol/port are correct.",
      };
    }

    return { ok: true, egressIp: body.ip, latencyMs, error: null };
  } catch (err) {
    const msg = (err as Error).message || String(err);
    const friendly = /abort/i.test(msg)
      ? `Timed out after ${timeoutMs / 1000}s — is the residential machine online and 3proxy running?`
      : `Connection failed: ${msg}`;
    return {
      ok: false,
      egressIp: null,
      latencyMs: Date.now() - started,
      error: friendly,
    };
  } finally {
    clearTimeout(timer);
  }
}
