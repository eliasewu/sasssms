/**
 * Shared server IPs and self-detection utility.
 * Used by support-tickets aggregation, tenant replication, and deploy scripts.
 */

export const ALL_SERVER_IPS = [
  "15.235.35.125",   // Canada — Toronto (Dev)
  "149.56.22.232",   // Canada — Toronto (Origin)
  "54.37.252.5",     // France — Paris
  "145.239.1.7",     // Germany — Frankfurt (Primary Mail Server)
  "139.99.148.65",   // Australia — Sydney
  "139.99.148.177",  // Australia — Sydney (2nd box)
] as const;

/**
 * Servers that must NEVER be assigned to tenants (dev/test boxes).
 * Auto-assignment in the registration routes filters these out so tenants
 * always land on production servers.
 */
export const DEV_SERVER_IPS = ["15.235.35.125"] as const;

export function isDevServer(ip: string | null | undefined): boolean {
  return !!ip && (DEV_SERVER_IPS as readonly string[]).includes(ip);
}

export const KNOWN_LABELS: Record<string, string> = {
  "15.235.35.125": "Canada — Toronto (Dev)",
  "149.56.22.232": "Canada — Toronto (Origin)",
  "54.37.252.5": "France — Paris",
  "145.239.1.7": "Germany — Frankfurt (Mail Server)",
  "139.99.148.65": "Australia — Sydney",
  "139.99.148.177": "Australia — Sydney (2nd box)",
};

export function serverLabel(ip: string): string {
  return KNOWN_LABELS[ip] || ip;
}

let _selfIp: string | null = null;

/** Detect our own public IP, preferring IPv4 (phones bind via IPv4 only).
 *  Tries api.ipify.org (IPv4-only) first, then 4.ifconfig.me, then ifconfig.me,
 *  and only accepts a valid IPv4 address. Cached, retries on failure. */
async function fetchIp(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    return (await r.text()).trim();
  } catch {
    return null;
  }
}

function isIPv4(v: string): boolean {
  if (!v) return false;
  const parts = v.split(".");
  if (parts.length !== 4) return false;
  return parts.every(p => /^\d{1,3}$/.test(p) && Number(p) >= 0 && Number(p) <= 255);
}

export async function getSelfIp(): Promise<string> {
  if (_selfIp) return _selfIp;
  const candidates = [
    "https://api.ipify.org",
    "http://4.ifconfig.me/ip",
    "http://ifconfig.me/ip",
  ];
  for (const url of candidates) {
    const v = await fetchIp(url, 2500);
    if (v && isIPv4(v)) {
      _selfIp = v;
      return v;
    }
  }
  _selfIp = null;
  return "127.0.0.1";
}
