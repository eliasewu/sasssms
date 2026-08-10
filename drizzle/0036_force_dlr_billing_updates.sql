-- 0036_force_dlr_billing_updates.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Applies the Custom Server Billing Matrix (Submit / DLR / Force DLR) to all
-- EXISTING tenants:
--
--   1. clients.dlr_timeout  → default 300s (5 min), backfill NULLs to 300
--   2. suppliers.dlr_timeout → default 300s (5 min), backfill NULLs to 300
--   3. messages.dlr_source   → new VARCHAR(20) column flagging synthetic
--      force-generated DLR results ('FORCE', 'FORCE_TIMEOUT', 'DLR_TIMEOUT')
--   4. custom_api_connectors.dlr_timeout_seconds → default 300s (was 3600);
--      rows still on the old 3600 default are aligned to 300s
--
-- New tenants get these defaults via src/lib/tenant-schema.ts instead.
-- Idempotent: safe to re-run (columns/backfills use IF NOT EXISTS / WHERE NULL).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT schema_name FROM tenants LOOP
    BEGIN
      -- ── 1. clients.dlr_timeout default + backfill ──
      IF to_regclass(format('%I.clients', t.schema_name)) IS NOT NULL THEN
        EXECUTE format('ALTER TABLE %I.clients ALTER COLUMN dlr_timeout SET DEFAULT 300', t.schema_name);
        EXECUTE format('UPDATE %I.clients SET dlr_timeout = 300 WHERE dlr_timeout IS NULL', t.schema_name);
      END IF;

      -- ── 2. suppliers.dlr_timeout default + backfill ──
      IF to_regclass(format('%I.suppliers', t.schema_name)) IS NOT NULL THEN
        EXECUTE format('ALTER TABLE %I.suppliers ALTER COLUMN dlr_timeout SET DEFAULT 300', t.schema_name);
        EXECUTE format('UPDATE %I.suppliers SET dlr_timeout = 300 WHERE dlr_timeout IS NULL', t.schema_name);
      END IF;

      -- ── 3. messages.dlr_source audit flag ──
      IF to_regclass(format('%I.messages', t.schema_name)) IS NOT NULL THEN
        EXECUTE format('ALTER TABLE %I.messages ADD COLUMN IF NOT EXISTS dlr_source VARCHAR(20)', t.schema_name);
      END IF;

      -- ── 4. custom_api_connectors timeout 3600 → 300 ──
      IF to_regclass(format('%I.custom_api_connectors', t.schema_name)) IS NOT NULL THEN
        EXECUTE format('ALTER TABLE %I.custom_api_connectors ALTER COLUMN dlr_timeout_seconds SET DEFAULT 300', t.schema_name);
        EXECUTE format('UPDATE %I.custom_api_connectors SET dlr_timeout_seconds = 300 WHERE dlr_timeout_seconds = 3600', t.schema_name);
      END IF;

      RAISE NOTICE '[0036] %: dlr_timeout=300, dlr_source added, custom_api 300s', t.schema_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[0036] %: skipped (%: %)', t.schema_name, SQLSTATE, SQLERRM;
    END;
  END LOOP;
END $$;
