-- 0033_dedupe_tenant_rate_tables.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Removes duplicate MCC/MNC rate entries from every tenant's client_rates and
-- supplier_rates tables.
--
-- Problem: the global mcc_mnc_database historically held MNCs in mixed
-- zero-padding ("3" vs "003") and country codes in mixed formats ("Ba" vs
-- "880"). Seed/import/push operations copied these into tenant rate tables,
-- deduplicating against the RAW mnc — so the same network could end up stored
-- twice (e.g. (470,'Ba',mnc '5') and (470,'880',mnc '005')).
--
-- What this migration does, per tenant, per rate table:
--   1. Backs up the full table to <table>_backup in the same schema when any
--      duplicate group exists (restore point).
--   2. Merges duplicate groups keyed on (entity_id, mcc, padded mnc, rate/cost,
--      is_active) — i.e. identical rows for the same network — keeping the row
--      whose country_code can actually match phone numbers (numeric dial code,
--      longer preferred), and copying any missing operator name from the dupes.
--   3. Normalizes all rows: mnc → zero-padded 3 digits, mccmnc backfilled
--      (NULL-mnc wildcard rows keep NULL mnc).
--
-- No unique index is added: the rate tables intentionally keep one row per rate
-- change (history), so uniqueness is enforced by the deactivate+insert code
-- paths instead (also fixed to use the padded MNC key).
--
-- Each tenant/table is wrapped in an exception handler so one schema quirk
-- doesn't abort the whole migration. Safe to re-run (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t             RECORD;
  tbl           TEXT;
  id_col        TEXT;
  val_col       TEXT;
  dup_groups    INT;
  g             RECORD;
  keep_id       INT;
  rc            INT;
  total_deleted INT := 0;
  total_backed  INT := 0;
BEGIN
  FOR t IN SELECT schema_name FROM tenants LOOP
    FOR tbl, id_col, val_col IN
      SELECT unnest(ARRAY['client_rates', 'supplier_rates']),
             unnest(ARRAY['client_id', 'supplier_id']),
             unnest(ARRAY['rate', 'cost'])
    LOOP
      BEGIN
        -- Skip tenants/schemas that don't have this table
        IF to_regclass(format('%I.%I', t.schema_name, tbl)) IS NULL THEN
          CONTINUE;
        END IF;

        -- Duplicate groups: same entity + mcc + padded mnc + value + active state
        EXECUTE format(
          'SELECT COUNT(*) FROM (
             SELECT 1 FROM %I.%I
             GROUP BY %s, mcc, LPAD(COALESCE(mnc,''''), 3, ''0''), %s, is_active
             HAVING COUNT(*) > 1
           ) d',
          t.schema_name, tbl, id_col, val_col
        ) INTO dup_groups;

        IF dup_groups > 0 THEN
          -- ── 1. Backup (rate tables are small — full snapshot) ──
          EXECUTE format('DROP TABLE IF EXISTS %I.%I_backup', t.schema_name, tbl);
          EXECUTE format('CREATE TABLE %I.%I_backup AS SELECT * FROM %I.%I', t.schema_name, tbl, t.schema_name, tbl);
          total_backed := total_backed + 1;

          -- ── 2. Merge + delete each duplicate group ──
          FOR g IN EXECUTE format(
            'SELECT %s AS eid, mcc, LPAD(COALESCE(mnc,''''), 3, ''0'') AS pk, %s AS val, is_active
             FROM %I.%I
             GROUP BY 1, 2, 3, 4, 5
             HAVING COUNT(*) > 1',
            id_col, val_col, t.schema_name, tbl
          )
          LOOP
            -- Keeper: prefer a numeric country code (actually matches phone
            -- numbers in rate lookups), then the longer code, then padded mnc,
            -- then a real operator name, then the lowest id.
            EXECUTE format(
              'SELECT id FROM %I.%I
               WHERE %s = %L AND mcc = %L AND LPAD(COALESCE(mnc,''''), 3, ''0'') = %L
                 AND %s = %L AND is_active = %L
               ORDER BY (country_code ~ ''^[0-9]'') DESC,
                        LENGTH(country_code) DESC,
                        (LENGTH(mnc) = 3) DESC,
                        (operator_name IS NOT NULL AND operator_name <> '''') DESC,
                        id ASC
               LIMIT 1',
              t.schema_name, tbl, id_col, g.eid, g.mcc, g.pk, val_col, g.val, g.is_active
            ) INTO keep_id;

            -- Copy missing fields from duplicates into the keeper
            EXECUTE format(
              'UPDATE %I.%I k SET
                 operator_name = COALESCE(NULLIF(k.operator_name, ''''), d.operator_name, k.operator_name)
               FROM (
                 SELECT MAX(operator_name) operator_name
                 FROM %I.%I
                 WHERE %s = %L AND mcc = %L AND LPAD(COALESCE(mnc,''''), 3, ''0'') = %L
                   AND %s = %L AND is_active = %L AND id <> %s
               ) d
               WHERE k.id = %s',
              t.schema_name, tbl,
              t.schema_name, tbl, id_col, g.eid, g.mcc, g.pk, val_col, g.val, g.is_active, keep_id,
              keep_id
            );

            EXECUTE format(
              'DELETE FROM %I.%I
               WHERE %s = %L AND mcc = %L AND LPAD(COALESCE(mnc,''''), 3, ''0'') = %L
                 AND %s = %L AND is_active = %L AND id <> %s',
              t.schema_name, tbl, id_col, g.eid, g.mcc, g.pk, val_col, g.val, g.is_active, keep_id
            );
            GET DIAGNOSTICS rc = ROW_COUNT;
            total_deleted := total_deleted + rc;
          END LOOP;
        END IF;

        -- ── 3. Normalize mnc / mccmnc (runs even with no duplicates) ──
        EXECUTE format(
          'UPDATE %I.%I SET
             mnc = CASE WHEN mnc IS NULL OR mnc = '''' THEN NULL ELSE LPAD(mnc, 3, ''0'') END,
             mccmnc = CASE WHEN mcc IS NOT NULL
                           THEN mcc || LPAD(COALESCE(mnc, ''''), 3, ''0'')
                           ELSE NULL END
           WHERE (mnc IS NULL OR mnc = '''' OR LENGTH(mnc) < 3
                  OR mccmnc IS NULL
                  OR mccmnc <> CASE WHEN mcc IS NOT NULL
                                    THEN mcc || LPAD(COALESCE(mnc, ''''), 3, ''0'')
                                    ELSE NULL END)',
          t.schema_name, tbl
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[rate-tables] % / % skipped: %', t.schema_name, tbl, SQLERRM;
      END;
    END LOOP;
  END LOOP;

  RAISE NOTICE '[rate-tables] dedup complete: % tables backed up, % duplicate rows deleted', total_backed, total_deleted;
END $$;
