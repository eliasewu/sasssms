-- Migration 0019: Add mccmnc column to translation_pool_items
-- Allows each pool item to be mapped to a specific MCC/MNC combination
-- for the visual MCC/MNC → SID mapping UI.
-- Run: psql $DATABASE_URL -f drizzle/0019_add_mccmnc_to_pool_items.sql

DO $$
DECLARE
    tenant RECORD;
BEGIN
    -- Add column to public schema template (for new tenants)
    ALTER TABLE translation_pool_items ADD COLUMN IF NOT EXISTS mccmnc VARCHAR(6);

    -- Add column to all tenant schemas
    FOR tenant IN SELECT schema_name FROM tenants WHERE is_active = true
    LOOP
        BEGIN
            EXECUTE format(
                'ALTER TABLE %I.translation_pool_items ADD COLUMN IF NOT EXISTS mccmnc VARCHAR(6)',
                tenant.schema_name
            );
            RAISE NOTICE '[%] Added mccmnc column to translation_pool_items', tenant.schema_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[%] Failed to add mccmnc column: %', tenant.schema_name, SQLERRM;
        END;
    END LOOP;
END $$;
