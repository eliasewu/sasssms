-- Migration 0014: Delete ALL client_rates and supplier_rates across all tenants
-- User will re-add rates client-wise manually.
-- Run: psql $DATABASE_URL -f drizzle/0014_delete_all_rates.sql

DO $$
DECLARE
    tenant RECORD;
    deleted_client BIGINT;
    deleted_supplier BIGINT;
BEGIN
    FOR tenant IN SELECT schema_name FROM tenants WHERE is_active = true
    LOOP
        BEGIN
            EXECUTE format('DELETE FROM %I.client_rates', tenant.schema_name);
            GET DIAGNOSTICS deleted_client = ROW_COUNT;
            RAISE NOTICE '[%] Deleted % rows from client_rates', tenant.schema_name, deleted_client;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed to delete client_rates: %', tenant.schema_name, SQLERRM;
        END;

        BEGIN
            EXECUTE format('DELETE FROM %I.supplier_rates', tenant.schema_name);
            GET DIAGNOSTICS deleted_supplier = ROW_COUNT;
            RAISE NOTICE '[%] Deleted % rows from supplier_rates', tenant.schema_name, deleted_supplier;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed to delete supplier_rates: %', tenant.schema_name, SQLERRM;
        END;
    END LOOP;
END $$;
