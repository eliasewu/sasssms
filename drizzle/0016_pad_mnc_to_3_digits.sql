-- Migration 0016: Zero-pad all MNC values to 3 digits across all tables
-- Updates: public.mcc_mnc_database, all tenant client_rates and supplier_rates
-- Run: psql $DATABASE_URL -f drizzle/0016_pad_mnc_to_3_digits.sql

DO $$
DECLARE
    tenant RECORD;
    updated_client BIGINT;
    updated_supplier BIGINT;
BEGIN
    -- ── 1. Update public mcc_mnc_database ──
    UPDATE mcc_mnc_database
    SET mnc = LPAD(mnc, 3, '0')
    WHERE mnc IS NOT NULL AND LENGTH(mnc) < 3;
    RAISE NOTICE '[public] Padded MNC in mcc_mnc_database';

    -- ── 2. Update all tenant schemas ──
    FOR tenant IN SELECT schema_name FROM tenants WHERE is_active = true
    LOOP
        BEGIN
            EXECUTE format('UPDATE %I.client_rates SET mnc = LPAD(mnc, 3, ''0'') WHERE mnc IS NOT NULL AND LENGTH(mnc) < 3', tenant.schema_name);
            GET DIAGNOSTICS updated_client = ROW_COUNT;
            RAISE NOTICE '[%] Padded % MNC values in client_rates', tenant.schema_name, updated_client;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed to pad client_rates MNC: %', tenant.schema_name, SQLERRM;
        END;

        BEGIN
            EXECUTE format('UPDATE %I.supplier_rates SET mnc = LPAD(mnc, 3, ''0'') WHERE mnc IS NOT NULL AND LENGTH(mnc) < 3', tenant.schema_name);
            GET DIAGNOSTICS updated_supplier = ROW_COUNT;
            RAISE NOTICE '[%] Padded % MNC values in supplier_rates', tenant.schema_name, updated_supplier;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed to pad supplier_rates MNC: %', tenant.schema_name, SQLERRM;
        END;
    END LOOP;
END $$;
