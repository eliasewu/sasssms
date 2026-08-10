/**
 * Gateway REST Auth — validates supplier credentials over HTTP.
 *
 * Mirrors the SMPP bind credential check: the APK sends its supplier
 * username + password with every REST call, and we look it up across all
 * active tenant schemas. Any active supplier can register via REST (the
 * typical case is an ANDROID_SMS supplier).
 */
import { pool } from "@/db";

// A gateway polls every ~3s + heartbeats every ~15s — re-scanning every tenant
// schema on each call would be DB-heavy with many gateways. Cache credentials
// for 60s; a password change takes effect within one TTL.
const AUTH_CACHE_TTL_MS = 60_000;
const _g = globalThis as typeof globalThis & {
  __restAuthCache?: Map<string, { result: GatewayAuthResult | null; at: number }>;
};
const authCache = _g.__restAuthCache ??= new Map();

export interface GatewayAuthResult {
  tenantId: number;
  schemaName: string;
  supplierId: number;
  username: string;
}

/**
 * Find the supplier matching these credentials (any active tenant).
 * Returns null on no match.
 */
export async function authenticateGateway(
  username: string,
  password: string
): Promise<GatewayAuthResult | null> {
  const uname = (username || "").trim();
  const pwd = password || "";
  if (!uname) return null;

  const cacheKey = `${uname}\u0000${pwd}`;
  const cached = authCache.get(cacheKey);
  if (cached && Date.now() - cached.at < AUTH_CACHE_TTL_MS) return cached.result;

  const client = await pool.connect();
  try {
    const { rows: tenants } = await client.query(
      "SELECT id, schema_name FROM tenants WHERE is_active = true"
    );
    for (const t of tenants) {
      try {
        await client.query(`SET search_path TO "${t.schema_name}"`);
        const { rows } = await client.query(
          `SELECT id, password FROM suppliers
           WHERE username = $1 AND is_active = true AND deleted_at IS NULL`,
          [uname]
        );
        for (const s of rows) {
          if ((s.password || "") === pwd) {
            const result: GatewayAuthResult = {
              tenantId: t.id,
              schemaName: t.schema_name,
              supplierId: s.id,
              username: uname,
            };
            authCache.set(cacheKey, { result, at: Date.now() });
            if (authCache.size > 10_000) {
              const now = Date.now();
              for (const [k, v] of authCache) {
                if (now - v.at > AUTH_CACHE_TTL_MS) authCache.delete(k);
              }
            }
            return result;
          }
        }
      } catch {
        // skip broken tenant schema
      }
    }
    authCache.set(cacheKey, { result: null, at: Date.now() });
    return null;
  } finally {
    try {
      await client.query("SET search_path TO public");
    } catch {}
    client.release();
  }
}

/** Mark a supplier as online (mirrors the SMPP bind status write). */
export async function setSupplierOnline(
  schemaName: string,
  supplierId: number
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    await client.query(
      `UPDATE suppliers SET bind_status = 'BOUND', bind_error = NULL,
       last_bind_time = NOW(), updated_at = NOW() WHERE id = $1`,
      [supplierId]
    );
  } catch (err) {
    console.error("[GATEWAY-REST] Failed to mark supplier online:", err);
  } finally {
    try {
      await client.query("SET search_path TO public");
    } catch {}
    client.release();
  }
}

/** Mark a supplier offline (bind_status UNBOUND). */
export async function setSupplierOffline(
  schemaName: string,
  supplierId: number
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    await client.query(
      `UPDATE suppliers SET bind_status = 'UNBOUND', updated_at = NOW() WHERE id = $1`,
      [supplierId]
    );
  } catch {
    // best-effort
  } finally {
    try {
      await client.query("SET search_path TO public");
    } catch {}
    client.release();
  }
}
