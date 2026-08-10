-- 0032_add_mcc_mnc_cleanup_stats.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Creates the mcc_mnc_cleanup_stats table and records the duplicate-removal
-- count from migration 0031 (which ran before stats recording existed).
--
-- The 0031 dedup migration removed 932 duplicate (mcc, mnc) rows from
-- mcc_mnc_database on 2026-08-07. This row powers the dashboard notice on
-- /dashboard/mcc-mnc. On fresh installs where 0031 already records its own
-- stats, the guard below skips the duplicate seed.
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mcc_mnc_cleanup_stats (
  id SERIAL PRIMARY KEY,
  removed_count INTEGER NOT NULL,
  removed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with the historical cleanup from migration 0031 (932 duplicates removed).
-- Only seeds when the table is empty: on fresh installs 0031 already records its
-- own count, so this row would be a duplicate record.
INSERT INTO mcc_mnc_cleanup_stats (removed_count, removed_at)
SELECT 932, now()
WHERE NOT EXISTS (SELECT 1 FROM mcc_mnc_cleanup_stats);
