/**
 * Per-tenant API load tracking (public schema `tenant_api_usage`).
 *
 * All tenants share one app process and one PostgreSQL instance, so exact
 * OS-level CPU/RAM attribution per tenant is impossible. Instead the Next.js
 * proxy (src/proxy.ts) records every authenticated /api/tenant/* request here,
 * and the super admin UI uses the real request load + latency as the
 * per-tenant CPU/RAM signal, plus per-schema DB size for exact storage.
 *
 * The recorder is intentionally fire-and-forget: it never awaits in the hot
 * path and never throws to callers, so tracking can never slow down or break
 * a tenant request.
 */
import { pool } from "@/db";

export interface ApiUsageSample {
  tenantId: number;
  schemaName: string;
  path: string;
  method: string;
  durationMs: number;
}

/**
 * Fire-and-forget upsert of a single request sample.
 * One row per (tenant_id, path, method, day); counts and latencies accumulate.
 * Returns the promise so the proxy can `event.waitUntil()` it — the internal
 * try/catch guarantees it never rejects, so it can also be left dangling.
 */
export function recordTenantApiUsage(sample: ApiUsageSample): Promise<void> {
  return (async () => {
    try {
      await pool.query(
        `INSERT INTO tenant_api_usage
           (tenant_id, schema_name, path, method, day, request_count, total_ms, max_ms, last_seen)
         VALUES ($1, $2, $3, $4, CURRENT_DATE, 1, $5::bigint, $5::int, NOW())
         ON CONFLICT (tenant_id, path, method, day)
         DO UPDATE SET
           request_count = tenant_api_usage.request_count + 1,
           total_ms      = tenant_api_usage.total_ms + EXCLUDED.total_ms,
           max_ms        = GREATEST(tenant_api_usage.max_ms, EXCLUDED.max_ms),
           last_seen     = NOW()`,
        [
          sample.tenantId,
          (sample.schemaName || "").slice(0, 100) || null,
          (sample.path || "").slice(0, 500),
          (sample.method || "GET").slice(0, 10),
          Math.max(0, Math.round(sample.durationMs)),
        ]
      );
    } catch (e) {
      console.error("[tenant-usage] record failed:", (e as Error).message);
    }
  })();
}

export interface TenantUsageSummary {
  requestsToday: number;
  requests7d: number;
  avgMsToday: number;
  avgMs7d: number;
  maxMs7d: number;
}

/**
 * Aggregate API usage per tenant: requests + avg latency today and over the
 * last 7 days (including today). Returns a map keyed by tenant id.
 */
export async function getTenantApiUsageSummary(): Promise<Map<number, TenantUsageSummary>> {
  const { rows } = await pool.query(
    `SELECT tenant_id,
            COALESCE(SUM(request_count) FILTER (WHERE day = CURRENT_DATE), 0)  AS requests_today,
            COALESCE(SUM(request_count) FILTER (WHERE day >= CURRENT_DATE - 6), 0) AS requests_7d,
            COALESCE(SUM(total_ms) FILTER (WHERE day = CURRENT_DATE), 0)       AS total_ms_today,
            COALESCE(SUM(total_ms) FILTER (WHERE day >= CURRENT_DATE - 6), 0)  AS total_ms_7d,
            COALESCE(MAX(max_ms) FILTER (WHERE day >= CURRENT_DATE - 6), 0)    AS max_ms_7d
     FROM tenant_api_usage
     GROUP BY tenant_id`
  );

  const map = new Map<number, TenantUsageSummary>();
  for (const r of rows) {
    const today = parseInt(r.requests_today, 10) || 0;
    const week = parseInt(r.requests_7d, 10) || 0;
    const todayMs = parseInt(r.total_ms_today, 10) || 0;
    const weekMs = parseInt(r.total_ms_7d, 10) || 0;
    map.set(parseInt(r.tenant_id, 10), {
      requestsToday: today,
      requests7d: week,
      avgMsToday: today ? Math.round(todayMs / today) : 0,
      avgMs7d: week ? Math.round(weekMs / week) : 0,
      maxMs7d: parseInt(r.max_ms_7d, 10) || 0,
    });
  }
  return map;
}

/**
 * Exact per-tenant DB storage: sum of pg_total_relation_size (tables + their
 * indexes + TOAST) over every table in each tenant schema.
 * Returns a map keyed by schema name → bytes.
 */
export async function getTenantSchemaStorageBytes(): Promise<Map<string, number>> {
  const { rows } = await pool.query(
    `SELECT schemaname,
            COALESCE(SUM(pg_total_relation_size(
              quote_ident(schemaname) || '.' || quote_ident(tablename)
            )), 0)::bigint AS bytes
     FROM pg_tables
     WHERE schemaname LIKE 'tenant\\_%'
     GROUP BY schemaname`
  );
  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.schemaname, parseInt(r.bytes, 10) || 0);
  }
  return map;
}
