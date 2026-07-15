-- Migration: Add operator_name column to client_rates and supplier_rates
-- Enables storing the human-readable operator/network name alongside each rate,
-- eliminating the need for live MCC/MNC lookups during display.
--
-- Run: psql $DATABASE_URL -f drizzle/0004_add_operator_name_to_rates.sql

DO $$
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN SELECT schema_name FROM tenants WHERE is_active = true
    LOOP
        BEGIN
            EXECUTE format(
                'ALTER TABLE %I.client_rates ADD COLUMN IF NOT EXISTS operator_name VARCHAR(255)',
                tenant.schema_name
            );
            RAISE NOTICE '[%] Added client_rates.operator_name', tenant.schema_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed to add client_rates.operator_name: %', tenant.schema_name, SQLERRM;
        END;

        BEGIN
            EXECUTE format(
                'ALTER TABLE %I.supplier_rates ADD COLUMN IF NOT EXISTS operator_name VARCHAR(255)',
                tenant.schema_name
            );
            RAISE NOTICE '[%] Added supplier_rates.operator_name', tenant.schema_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed to add supplier_rates.operator_name: %', tenant.schema_name, SQLERRM;
        END;

        -- Backfill operator_name from mcc_mnc_database where NULL
        BEGIN
            EXECUTE format(
                'UPDATE %I.client_rates cr SET operator_name = mdb.network_name
                 FROM public.mcc_mnc_database mdb
                 WHERE cr.mcc = mdb.mcc
                   AND COALESCE(cr.mnc, '''') = COALESCE(mdb.mnc, '''')
                   AND cr.operator_name IS NULL',
                tenant.schema_name
            );
            RAISE NOTICE '[%] Backfilled client_rates.operator_name', tenant.schema_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Skipping client_rates backfill: %', tenant.schema_name, SQLERRM;
        END;

        BEGIN
            EXECUTE format(
                'UPDATE %I.supplier_rates sr SET operator_name = mdb.network_name
                 FROM public.mcc_mnc_database mdb
                 WHERE sr.mcc = mdb.mcc
                   AND COALESCE(sr.mnc, '''') = COALESCE(mdb.mnc, '''')
                   AND sr.operator_name IS NULL',
                tenant.schema_name
            );
            RAISE NOTICE '[%] Backfilled supplier_rates.operator_name', tenant.schema_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Skipping supplier_rates backfill: %', tenant.schema_name, SQLERRM;
        END;

        RAISE NOTICE 'Migrated schema: %', tenant.schema_name;
    END LOOP;

    EXECUTE 'SET search_path TO public';
END $$;
