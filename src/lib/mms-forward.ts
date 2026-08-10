/**
 * MMS forwarding setting — per-tenant control over whether [MMS] placeholder
 * MOs (forwarded by the Android gateway when it receives a WAP_PUSH MMS
 * notification) are stored in the tenant's sms_inbox.
 *
 * When disabled, [MMS] notifications are still acknowledged to the gateway
 * (the phone doesn't retry) but dropped instead of polluting the inbox.
 * Reads are cached 30s per tenant — MMS volume is low, and toggling through
 * the dashboard invalidates the cache immediately. Note: direct-SQL edits to
 * the flag (outside the dashboard API) are served stale for up to one TTL;
 * the permissive default (store, never drop) is the safe direction.
 */
import { pool } from "@/db";

/**
 * The Android gateway forwards MMS notifications as placeholder MOs with this
 * exact content prefix (see the APK's SmsReceiver/GatewayTask). The server
 * contract keys on it — keep it in one place so enforcement never drifts.
 */
export const MMS_PLACEHOLDER_PREFIX = "[MMS]";

/** Is this MO content an MMS placeholder notification from a gateway? */
export function isMmsPlaceholder(content: string): boolean {
  return content.startsWith(MMS_PLACEHOLDER_PREFIX);
}

const CACHE_TTL_MS = 30_000;

const _g = globalThis as typeof globalThis & {
  __mmsForwardCache?: Map<number, { enabled: boolean; at: number }>;
};
const cache = _g.__mmsForwardCache ??= new Map();

/** Is MMS forwarding enabled for this tenant? (default: enabled) */
export async function isMmsForwardEnabled(tenantId: number): Promise<boolean> {
  const cached = cache.get(tenantId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.enabled;

  let enabled = true;
  try {
    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        "SELECT mms_forward_enabled FROM tenants WHERE id = $1",
        [tenantId]
      );
      enabled = rows[0]?.mms_forward_enabled !== false;
    } finally {
      client.release();
    }
  } catch {
    // DB hiccup — be permissive, never drop MMS on a transient error
    enabled = true;
  }
  cache.set(tenantId, { enabled, at: Date.now() });
  return enabled;
}

/** Invalidate the cached flag (call after the tenant updates the setting). */
export function invalidateMmsForwardCache(tenantId: number): void {
  cache.delete(tenantId);
}
