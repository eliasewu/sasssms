-- ============================================================================
-- CLEANUP: Remove mock/inactive tenants from the database
-- Run with: psql $DATABASE_URL -f cleanup-mock-tenants.sql
-- ============================================================================

-- Step 1: List tenants that will be removed (preview)
SELECT id, company_name, email, schema_name, status, is_active, created_at
FROM tenants
WHERE is_active = false OR status = 'inactive'
ORDER BY id;

-- ⚠️  Uncomment the following lines to actually perform the deletion ⚠️

-- Step 2: Drop each inactive tenant's isolated schema
-- DO $$
-- DECLARE
--   r RECORD;
-- BEGIN
--   FOR r IN SELECT schema_name FROM tenants WHERE is_active = false OR status = 'inactive'
--   LOOP
--     EXECUTE 'DROP SCHEMA IF EXISTS "' || r.schema_name || '" CASCADE';
--     RAISE NOTICE 'Dropped schema: %', r.schema_name;
--   END LOOP;
-- END $$;

-- Step 3: Delete the tenant records from public.tenants
-- DELETE FROM tenants WHERE is_active = false OR status = 'inactive';
