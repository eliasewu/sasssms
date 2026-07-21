-- Migration 0017: Add mccmnc column to client_rates and supplier_rates across all tenants
-- Populates with mcc || LPAD(COALESCE(mnc, ''), 3, '0') for existing rows

DO $$
DECLARE
  t RECORD;
  added_count INTEGER;
  populated_count INTEGER;
BEGIN
  FOR t IN SELECT schema_name FROM tenants WHERE is_active = true
  LOOP
    -- client_rates: add column if not exists
    BEGIN
      EXECUTE format('ALTER TABLE %I.client_rates ADD COLUMN IF NOT EXISTS mccmnc VARCHAR(6)', t.schema_name);
      RAISE NOTICE '[%] client_rates.mccmnc column ensured', t.schema_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[%] client_rates.mccmnc add failed: %', t.schema_name, SQLERRM;
    END;

    -- client_rates: populate mccmnc for existing rows
    BEGIN
      EXECUTE format('UPDATE %I.client_rates SET mccmnc = mcc || LPAD(COALESCE(mnc, ''''), 3, ''0'') WHERE mccmnc IS NULL AND mcc IS NOT NULL', t.schema_name);
      GET DIAGNOSTICS populated_count = ROW_COUNT;
      RAISE NOTICE '[%] client_rates: % rows populated with mccmnc', t.schema_name, populated_count;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[%] client_rates mccmnc populate failed: %', t.schema_name, SQLERRM;
    END;

    -- supplier_rates: add column if not exists
    BEGIN
      EXECUTE format('ALTER TABLE %I.supplier_rates ADD COLUMN IF NOT EXISTS mccmnc VARCHAR(6)', t.schema_name);
      RAISE NOTICE '[%] supplier_rates.mccmnc column ensured', t.schema_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[%] supplier_rates.mccmnc add failed: %', t.schema_name, SQLERRM;
    END;

    -- supplier_rates: populate mccmnc for existing rows
    BEGIN
      EXECUTE format('UPDATE %I.supplier_rates SET mccmnc = mcc || LPAD(COALESCE(mnc, ''''), 3, ''0'') WHERE mccmnc IS NULL AND mcc IS NOT NULL', t.schema_name);
      GET DIAGNOSTICS populated_count = ROW_COUNT;
      RAISE NOTICE '[%] supplier_rates: % rows populated with mccmnc', t.schema_name, populated_count;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '[%] supplier_rates mccmnc populate failed: %', t.schema_name, SQLERRM;
    END;
  END LOOP;
END $$;
