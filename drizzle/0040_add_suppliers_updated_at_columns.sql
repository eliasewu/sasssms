-- Migration 0040: Add updated_at / deleted_at / deleted_by / gsm_device_id / connector_id
-- to suppliers across ALL tenant schemas (including inactive, so re-activated tenants work).
--
-- Why: createTenantSchema() uses "CREATE TABLE IF NOT EXISTS suppliers (...)" which is a
-- no-op on tables that already exist. Tenant schemas created before these columns were
-- added to the bootstrap definition never received them, so the app's
-- "UPDATE suppliers SET ... updated_at = NOW()" fails and the tenant gets skipped.
--
-- Run: psql $DATABASE_URL -f drizzle/0040_add_suppliers_updated_at_columns.sql

DO $$
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN SELECT schema_name FROM tenants
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I.suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()', tenant.schema_name);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed suppliers.updated_at: %', tenant.schema_name, SQLERRM;
        END;

        BEGIN
            EXECUTE format('ALTER TABLE %I.suppliers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP', tenant.schema_name);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed suppliers.deleted_at: %', tenant.schema_name, SQLERRM;
        END;

        BEGIN
            EXECUTE format('ALTER TABLE %I.suppliers ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(255)', tenant.schema_name);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed suppliers.deleted_by: %', tenant.schema_name, SQLERRM;
        END;

        BEGIN
            EXECUTE format('ALTER TABLE %I.suppliers ADD COLUMN IF NOT EXISTS gsm_device_id INTEGER', tenant.schema_name);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed suppliers.gsm_device_id: %', tenant.schema_name, SQLERRM;
        END;

        BEGIN
            EXECUTE format('ALTER TABLE %I.suppliers ADD COLUMN IF NOT EXISTS connector_id INTEGER', tenant.schema_name);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed suppliers.connector_id: %', tenant.schema_name, SQLERRM;
        END;
    END LOOP;
END $$;
