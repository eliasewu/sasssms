-- Migration: Drop legacy rate_per_sms and cost_per_sms columns from ALL tenant schemas
-- These columns are no longer populated — rates are now resolved at send-time from
-- the client_rates / supplier_rates tables via lookupClientRate / lookupSupplierCost.
--
-- Run: psql $DATABASE_URL -f drizzle/0003_drop_rate_per_sms_cost_per_sms.sql

DO $$
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN SELECT schema_name FROM tenants WHERE is_active = true
    LOOP
        -- Drop rate_per_sms from clients table (now using client_rates lookup)
        BEGIN
            EXECUTE format(
                'ALTER TABLE %I.clients DROP COLUMN IF EXISTS rate_per_sms',
                tenant.schema_name
            );
            RAISE NOTICE '[%] Dropped clients.rate_per_sms', tenant.schema_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed to drop clients.rate_per_sms: %', tenant.schema_name, SQLERRM;
        END;

        -- Drop cost_per_sms from suppliers table (now using supplier_rates lookup)
        BEGIN
            EXECUTE format(
                'ALTER TABLE %I.suppliers DROP COLUMN IF EXISTS cost_per_sms',
                tenant.schema_name
            );
            RAISE NOTICE '[%] Dropped suppliers.cost_per_sms', tenant.schema_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed to drop suppliers.cost_per_sms: %', tenant.schema_name, SQLERRM;
        END;

        RAISE NOTICE 'Migrated schema: %', tenant.schema_name;
    END LOOP;

    EXECUTE 'SET search_path TO public';
END $$;
