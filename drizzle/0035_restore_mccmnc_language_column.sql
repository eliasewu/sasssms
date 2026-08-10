-- 0035_restore_mccmnc_language_column.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Fixes a production regression: deploy.sh runs `npx drizzle-kit push`, which
-- syncs the DB to src/db/schema.ts and DROPS any column/table not declared
-- there. schema.ts omitted several public-schema objects that the app uses,
-- so production DBs lost them:
--   • mcc_mnc_database.language   (migration 0000) — breaks the tenant MCC/MNC
--     list and CSV download with "column language does not exist" →
--     "Failed to load MCC/MNC database".
--   • mcc_mnc_cleanup_stats table (migration 0032) — dedup notice data.
--   • smpp_server_config table    — tenant SMPP servers page.
--   • subscription_reminders      — expiry reminder emails dedup.
--
-- This restores all of them. Idempotent (IF NOT EXISTS), safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Restore the language column on the global MCC/MNC database.
ALTER TABLE mcc_mnc_database
  ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT 'English';

-- 2. Restore the dedup cleanup stats table (migration 0032).
CREATE TABLE IF NOT EXISTS mcc_mnc_cleanup_stats (
  id SERIAL PRIMARY KEY,
  removed_count INTEGER NOT NULL,
  removed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Re-seed the historical cleanup record (same as 0032) so the "N duplicate
-- entries auto-removed" notice is preserved after a restore. Guarded so it
-- never duplicates an existing row.
INSERT INTO mcc_mnc_cleanup_stats (removed_count, removed_at)
SELECT 932, now()
WHERE NOT EXISTS (SELECT 1 FROM mcc_mnc_cleanup_stats);

-- 3. Restore the SMPP server configs table (public, shared across tenants).
CREATE TABLE IF NOT EXISTS smpp_server_config (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER,
  name VARCHAR(255) DEFAULT 'Default SMSC',
  host VARCHAR(100) DEFAULT '0.0.0.0',
  port INTEGER DEFAULT 2775,
  max_connections INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- 4. Restore the subscription reminders dedup table (public).
CREATE TABLE IF NOT EXISTS subscription_reminders (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER,
  days_before INTEGER,
  sent_at TIMESTAMP DEFAULT now()
);
