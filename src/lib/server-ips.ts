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
] as const;

export const KNOWN_LABELS: Record<string, string> = {
  "15.235.35.125": "Canada — Toronto (Dev)",
  "149.56.22.232": "Canada — Toronto (Origin)",
  "54.37.252.5": "France — Paris",
  "145.239.1.7": "Germany — Frankfurt (Mail Server)",
  "139.99.148.65": "Australia — Sydney",
};

export function serverLabel(ip: string): string {
  return KNOWN_LABELS[ip] || ip;
}

let _selfIp: string | null = null;

/** Detect our own public IP via ifconfig.me (cached, retries on failure). */
export async function getSelfIp(): Promise<string> {
  if (_selfIp) return _selfIp;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2000);
    const r = await fetch("http://ifconfig.me/ip", { signal: ctl.signal });
    clearTimeout(t);
    _selfIp = (await r.text()).trim();
  } catch {
    _selfIp = null; // retry next request
  }
  return _selfIp || "127.0.0.1";
}
