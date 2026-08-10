-- 0034_add_tenant_api_usage.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Per-tenant API load tracking (public schema).
--
-- All tenants share one app process and one PostgreSQL instance, so OS-level
-- CPU/RAM cannot be attributed per tenant. Instead the Next.js proxy records
-- every authenticated /api/tenant/* request (tenant id, endpoint, method,
-- latency) here, aggregated per day. The super admin UI uses this as the
-- real per-tenant CPU/RAM load signal, plus per-schema DB size (pg_*_size)
-- for exact per-tenant storage.
--
-- Row key: (tenant_id, path, method, day) — one row per endpoint per day.
-- The recorder upserts (count+1, total_ms+latency, max_ms=GREATEST), so the
-- table stays small regardless of request volume.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_api_usage (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL,
  schema_name   VARCHAR(100),
  path          TEXT NOT NULL,
  method        VARCHAR(10) NOT NULL,
  day           DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 0,
  total_ms      BIGINT NOT NULL DEFAULT 0,
  max_ms        INTEGER NOT NULL DEFAULT 0,
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upsert target for the recorder
CREATE UNIQUE INDEX IF NOT EXISTS tenant_api_usage_day_key
  ON tenant_api_usage (tenant_id, path, method, day);

-- Super-admin aggregation: per-tenant daily totals
CREATE INDEX IF NOT EXISTS tenant_api_usage_tenant_day_idx
  ON tenant_api_usage (tenant_id, day);
