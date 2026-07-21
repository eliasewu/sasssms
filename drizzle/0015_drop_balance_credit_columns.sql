-- Migration 0015: Drop balance and credit_limit from clients, and initial_balance and credit_limit from suppliers
-- across all active tenant schemas.
-- Run: psql $DATABASE_URL -f drizzle/0015_drop_balance_credit_columns.sql

DO $$
DECLARE
    tenant RECORD;
BEGIN
    FOR tenant IN SELECT schema_name FROM tenants WHERE is_active = true
    LOOP
        -- Drop balance from clients
        BEGIN
            EXECUTE format('ALTER TABLE %I.clients DROP COLUMN IF EXISTS balance', tenant.schema_name);
            RAISE NOTICE '[%] Dropped clients.balance', tenant.schema_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed to drop clients.balance: %', tenant.schema_name, SQLERRM;
        END;

        -- Drop credit_limit from clients
        BEGIN
            EXECUTE format('ALTER TABLE %I.clients DROP COLUMN IF EXISTS credit_limit', tenant.schema_name);
            RAISE NOTICE '[%] Dropped clients.credit_limit', tenant.schema_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed to drop clients.credit_limit: %', tenant.schema_name, SQLERRM;
        END;

        -- Drop initial_balance from suppliers
        BEGIN
            EXECUTE format('ALTER TABLE %I.suppliers DROP COLUMN IF EXISTS initial_balance', tenant.schema_name);
            RAISE NOTICE '[%] Dropped suppliers.initial_balance', tenant.schema_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed to drop suppliers.initial_balance: %', tenant.schema_name, SQLERRM;
        END;

        -- Drop credit_limit from suppliers
        BEGIN
            EXECUTE format('ALTER TABLE %I.suppliers DROP COLUMN IF EXISTS credit_limit', tenant.schema_name);
            RAISE NOTICE '[%] Dropped suppliers.credit_limit', tenant.schema_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed to drop suppliers.credit_limit: %', tenant.schema_name, SQLERRM;
        END;
    END LOOP;
END $$;
