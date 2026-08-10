-- Migration 0036: Per-OTT-device send quotas (daily 250 / monthly 1000)
--
-- Adds editable limits plus rolling usage counters to every active tenant's
-- ott_devices table. sendOttMessage enforces the limits atomically:
--   daily_sent  resets whenever daily_reset_date != CURRENT_DATE
--   monthly_sent resets whenever monthly_reset_month != YYYY-MM
-- Run: psql $DATABASE_URL -f drizzle/0036_add_ott_device_limits.sql
--
-- New tenants already get these columns from src/lib/tenant-schema.ts.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT schema_name FROM tenants WHERE is_active = true
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I.ott_devices ADD COLUMN IF NOT EXISTS daily_limit INTEGER NOT NULL DEFAULT 250', t.schema_name);
      RAISE NOTICE 'daily_limit added to %.', t.schema_name;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipping daily_limit for %: %', t.schema_name, SQLERRM;
    END;

    BEGIN
      EXECUTE format('ALTER TABLE %I.ott_devices ADD COLUMN IF NOT EXISTS monthly_limit INTEGER NOT NULL DEFAULT 1000', t.schema_name);
      RAISE NOTICE 'monthly_limit added to %.', t.schema_name;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipping monthly_limit for %: %', t.schema_name, SQLERRM;
    END;

    BEGIN
      EXECUTE format('ALTER TABLE %I.ott_devices ADD COLUMN IF NOT EXISTS daily_sent INTEGER NOT NULL DEFAULT 0', t.schema_name);
      RAISE NOTICE 'daily_sent added to %.', t.schema_name;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipping daily_sent for %: %', t.schema_name, SQLERRM;
    END;

    BEGIN
      EXECUTE format('ALTER TABLE %I.ott_devices ADD COLUMN IF NOT EXISTS monthly_sent INTEGER NOT NULL DEFAULT 0', t.schema_name);
      RAISE NOTICE 'monthly_sent added to %.', t.schema_name;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipping monthly_sent for %: %', t.schema_name, SQLERRM;
    END;

    BEGIN
      EXECUTE format('ALTER TABLE %I.ott_devices ADD COLUMN IF NOT EXISTS daily_reset_date DATE DEFAULT CURRENT_DATE', t.schema_name);
      RAISE NOTICE 'daily_reset_date added to %.', t.schema_name;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipping daily_reset_date for %: %', t.schema_name, SQLERRM;
    END;

    BEGIN
      EXECUTE format('ALTER TABLE %I.ott_devices ADD COLUMN IF NOT EXISTS monthly_reset_month VARCHAR(7) DEFAULT to_char(CURRENT_DATE, ''YYYY-MM'')', t.schema_name);
      RAISE NOTICE 'monthly_reset_month added to %.', t.schema_name;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipping monthly_reset_month for %: %', t.schema_name, SQLERRM;
    END;
  END LOOP;
END $$;
