-- Migration 0018: Zero-pad MNC values to 3 digits in translation_profiles
-- across all tenant schemas. 0016 only covered mcc_mnc_database/client_rates/supplier_rates.
-- Run: psql $DATABASE_URL -f drizzle/0018_pad_mnc_in_translation_profiles.sql

DO $$
DECLARE
    tenant RECORD;
    updated BIGINT;
BEGIN
    FOR tenant IN SELECT schema_name FROM tenants WHERE is_active = true
    LOOP
        BEGIN
            EXECUTE format(
                'UPDATE %I.translation_profiles SET mnc = LPAD(mnc, 3, ''0'') WHERE mnc IS NOT NULL AND mnc != ''*'' AND LENGTH(mnc) < 3',
                tenant.schema_name
            );
            GET DIAGNOSTICS updated = ROW_COUNT;
            RAISE NOTICE '[%] Padded % MNC values in translation_profiles', tenant.schema_name, updated;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed to pad translation_profiles MNC: %', tenant.schema_name, SQLERRM;
        END;
    END LOOP;
END $$;
