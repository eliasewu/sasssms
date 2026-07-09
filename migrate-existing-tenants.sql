-- Migration: Add new columns to all existing tenant schemas
-- Run: psql $DATABASE_URL -f migrate-existing-tenants.sql

DO $$
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN SELECT schema_name FROM tenants WHERE is_active = true
    LOOP
        EXECUTE format('SET search_path TO %I', tenant.schema_name);

        -- messages: supplier_cost + profit
        BEGIN
            EXECUTE format('ALTER TABLE %I.messages ADD COLUMN IF NOT EXISTS supplier_cost DECIMAL(10,6) DEFAULT 0', tenant.schema_name);
        EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipping supplier_cost for %: %', tenant.schema_name, SQLERRM;
        END;
        BEGIN
            EXECUTE format('ALTER TABLE %I.messages ADD COLUMN IF NOT EXISTS profit DECIMAL(10,6) DEFAULT 0', tenant.schema_name);
        EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipping profit for %: %', tenant.schema_name, SQLERRM;
        END;

        -- suppliers: connection_mode
        BEGIN
            EXECUTE format('ALTER TABLE %I.suppliers ADD COLUMN IF NOT EXISTS connection_mode VARCHAR(20) DEFAULT ''CLIENT''', tenant.schema_name);
        EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipping connection_mode for %: %', tenant.schema_name, SQLERRM;
        END;

        -- invoices: created_by, created_for_type, created_for_id, created_for_name
        BEGIN
            EXECUTE format('ALTER TABLE %I.invoices ADD COLUMN IF NOT EXISTS created_by VARCHAR(255)', tenant.schema_name);
        EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipping created_by for %: %', tenant.schema_name, SQLERRM;
        END;
        BEGIN
            EXECUTE format('ALTER TABLE %I.invoices ADD COLUMN IF NOT EXISTS created_for_type VARCHAR(20)', tenant.schema_name);
        EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipping created_for_type for %: %', tenant.schema_name, SQLERRM;
        END;
        BEGIN
            EXECUTE format('ALTER TABLE %I.invoices ADD COLUMN IF NOT EXISTS created_for_id INTEGER', tenant.schema_name);
        EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipping created_for_id for %: %', tenant.schema_name, SQLERRM;
        END;
        BEGIN
            EXECUTE format('ALTER TABLE %I.invoices ADD COLUMN IF NOT EXISTS created_for_name VARCHAR(255)', tenant.schema_name);
        EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'Skipping created_for_name for %: %', tenant.schema_name, SQLERRM;
        END;

        RAISE NOTICE 'Migrated schema: %', tenant.schema_name;
    END LOOP;

    EXECUTE 'SET search_path TO public';
END $$;
