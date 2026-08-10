-- 0031_dedupe_mcc_mnc_database.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Removes duplicate MCC/MNC entries from the global mcc_mnc_database table.
--
-- Problem: migration 0016 padded all MNCs to 3 digits, but the CSV sync script
-- and the API routes deduplicated against the RAW mnc string. Every sync then
-- re-inserted the unpadded rows (e.g. "3" next to the padded "003"), creating
-- ~900 duplicate (mcc, mnc) pairs visible on the dashboard.
--
-- What this migration does:
--   1. Backs up the full table to mcc_mnc_database_backup (restore point).
--   2. Merges duplicate groups (same mcc + padded mnc), keeping the most
--      complete row and copying any missing fields from the duplicates.
--   3. Normalizes every remaining row: mnc → LPAD(..., 3, '0'), mccmnc backfilled.
--   4. Adds a UNIQUE index on (mcc, LPAD(COALESCE(mnc,''),3,'0')) so no
--      future insert can re-create a duplicate.
--
-- Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Backup ──
DROP TABLE IF EXISTS mcc_mnc_database_backup;
CREATE TABLE mcc_mnc_database_backup AS
  SELECT * FROM mcc_mnc_database;

-- ── 2. Merge + delete duplicate groups ──
DO $$
DECLARE
  r        RECORD;
  keep_id  INT;
  deleted  INT := 0;
BEGIN
  FOR r IN
    SELECT mcc,
           LPAD(COALESCE(mnc, ''), 3, '0') AS pk,
           COUNT(*)                        AS c
    FROM mcc_mnc_database
    GROUP BY 1, 2
    HAVING COUNT(*) > 1
  LOOP
    -- Keeper: prefer the already-padded 3-digit row, then a specific network
    -- name (not an "all operators" placeholder), then a row with a real
    -- network name, then the lowest id.
    SELECT id INTO keep_id
    FROM mcc_mnc_database
    WHERE mcc = r.mcc
      AND LPAD(COALESCE(mnc, ''), 3, '0') = r.pk
    ORDER BY (LENGTH(mnc) = 3) DESC,
             (network_name NOT ILIKE '%all operators%') DESC,
             (network_name IS NOT NULL AND network_name <> '') DESC,
             id ASC
    LIMIT 1;

    -- Copy any fields the duplicates have that the keeper is missing.
    UPDATE mcc_mnc_database k
    SET network_name = COALESCE(NULLIF(k.network_name, ''), d.network_name, k.network_name),
        network_type = COALESCE(k.network_type, d.network_type, k.network_type),
        language     = COALESCE(k.language, d.language, k.language),
        mccmnc       = k.mcc || LPAD(COALESCE(k.mnc, ''), 3, '0')
    FROM (
      SELECT MAX(network_name) AS network_name,
             MAX(network_type) AS network_type,
             MAX(language)     AS language
      FROM mcc_mnc_database
      WHERE mcc = r.mcc
        AND LPAD(COALESCE(mnc, ''), 3, '0') = r.pk
        AND id <> keep_id
    ) d
    WHERE k.id = keep_id;

    DELETE FROM mcc_mnc_database
    WHERE mcc = r.mcc
      AND LPAD(COALESCE(mnc, ''), 3, '0') = r.pk
      AND id <> keep_id;

    deleted := deleted + (r.c - 1);
  END LOOP;

  RAISE NOTICE '[mcc_mnc_database] Deleted % duplicate rows', deleted;
END $$;

-- ── 3. Normalize mnc → 3 digits and backfill mccmnc ──
UPDATE mcc_mnc_database
SET mnc    = LPAD(COALESCE(mnc, ''), 3, '0'),
    mccmnc = mcc || LPAD(COALESCE(mnc, ''), 3, '0')
WHERE mnc <> LPAD(COALESCE(mnc, ''), 3, '0')
   OR mccmnc IS NULL
   OR mccmnc <> mcc || LPAD(COALESCE(mnc, ''), 3, '0');

-- ── 4. Unique guard index (prevents future duplicates) ──
DROP INDEX IF EXISTS idx_mcc_mnc_database_unique;
CREATE UNIQUE INDEX idx_mcc_mnc_database_unique
  ON mcc_mnc_database (mcc, LPAD(COALESCE(mnc, ''), 3, '0'));

-- ── 5. Record cleanup stats (drives the dashboard cleanup notice) ──
-- The backup still holds the pre-dedup rows at this point, so count how many
-- duplicate rows were merged/deleted and store it as a durable record.
CREATE TABLE IF NOT EXISTS mcc_mnc_cleanup_stats (
  id SERIAL PRIMARY KEY,
  removed_count INTEGER NOT NULL,
  removed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO mcc_mnc_cleanup_stats (removed_count, removed_at)
SELECT removed, now()
FROM (
  SELECT COALESCE(SUM(c - 1), 0) AS removed
  FROM (
    SELECT COUNT(*) c
    FROM mcc_mnc_database_backup
    GROUP BY mcc, LPAD(COALESCE(mnc, ''), 3, '0')
    HAVING COUNT(*) > 1
  ) dup
) stats
WHERE stats.removed > 0;
