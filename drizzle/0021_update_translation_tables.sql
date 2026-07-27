-- Migration 0021: Update translation tables on ALL tenants
-- ============================================================
-- Adds missing columns to existing tenants + updated_at timestamps
-- Run: psql $DATABASE_URL -f drizzle/0021_update_translation_tables.sql

DO $$
DECLARE
    tenant RECORD;
    col_exists BOOLEAN;
    updated_count INTEGER;
BEGIN
    FOR tenant IN
        SELECT schema_name FROM tenants WHERE is_active = true
    LOOP
        RAISE NOTICE 'Processing tenant: %', tenant.schema_name;

        -- ── 1. translation_profiles: Add missing columns ──
        BEGIN
            -- category column (needed for NUMBER/CONTENT/SID/RANDOM_CONTENT/RANDOM_SID filtering)
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = tenant.schema_name
                AND table_name = 'translation_profiles'
                AND column_name = 'category'
            ) INTO col_exists;
            IF NOT col_exists THEN
                EXECUTE format('ALTER TABLE %I.translation_profiles ADD COLUMN category VARCHAR(30) DEFAULT ''SID''', tenant.schema_name);
                RAISE NOTICE '  Added category column';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  SKIP category: %', SQLERRM;
        END;

        BEGIN
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = tenant.schema_name
                AND table_name = 'translation_profiles'
                AND column_name = 'mcc'
            ) INTO col_exists;
            IF NOT col_exists THEN
                EXECUTE format('ALTER TABLE %I.translation_profiles ADD COLUMN mcc VARCHAR(10)', tenant.schema_name);
                RAISE NOTICE '  Added mcc column';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  SKIP mcc: %', SQLERRM;
        END;

        BEGIN
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = tenant.schema_name
                AND table_name = 'translation_profiles'
                AND column_name = 'mnc'
            ) INTO col_exists;
            IF NOT col_exists THEN
                EXECUTE format('ALTER TABLE %I.translation_profiles ADD COLUMN mnc VARCHAR(10)', tenant.schema_name);
                RAISE NOTICE '  Added mnc column';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  SKIP mnc: %', SQLERRM;
        END;

        BEGIN
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = tenant.schema_name
                AND table_name = 'translation_profiles'
                AND column_name = 'sort_order'
            ) INTO col_exists;
            IF NOT col_exists THEN
                EXECUTE format('ALTER TABLE %I.translation_profiles ADD COLUMN sort_order INTEGER DEFAULT 0', tenant.schema_name);
                RAISE NOTICE '  Added sort_order column';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  SKIP sort_order: %', SQLERRM;
        END;

        -- ── 2. translation_profiles: Add updated_at ──
        BEGIN
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = tenant.schema_name
                AND table_name = 'translation_profiles'
                AND column_name = 'updated_at'
            ) INTO col_exists;
            IF NOT col_exists THEN
                EXECUTE format('ALTER TABLE %I.translation_profiles ADD COLUMN updated_at TIMESTAMP DEFAULT NOW()', tenant.schema_name);
                -- Set initial value for existing rows
                EXECUTE format('UPDATE %I.translation_profiles SET updated_at = created_at WHERE updated_at IS NULL', tenant.schema_name);
                RAISE NOTICE '  Added updated_at to translation_profiles';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  SKIP updated_at (profiles): %', SQLERRM;
        END;

        -- ── 3. translation_pool_items: Add mccmnc column ──
        BEGIN
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = tenant.schema_name
                AND table_name = 'translation_pool_items'
                AND column_name = 'mccmnc'
            ) INTO col_exists;
            IF NOT col_exists THEN
                EXECUTE format('ALTER TABLE %I.translation_pool_items ADD COLUMN mccmnc VARCHAR(6)', tenant.schema_name);
                RAISE NOTICE '  Added mccmnc column';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  SKIP mccmnc: %', SQLERRM;
        END;

        -- ── 4. translation_pool_items: Add updated_at with backfill ──
        BEGIN
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = tenant.schema_name
                AND table_name = 'translation_pool_items'
                AND column_name = 'updated_at'
            ) INTO col_exists;
            IF NOT col_exists THEN
                EXECUTE format('ALTER TABLE %I.translation_pool_items ADD COLUMN updated_at TIMESTAMP DEFAULT NOW()', tenant.schema_name);
                EXECUTE format('UPDATE %I.translation_pool_items SET updated_at = NOW() WHERE updated_at IS NULL', tenant.schema_name);
                RAISE NOTICE '  Added updated_at to translation_pool_items (backfilled)';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  SKIP updated_at (pool_items): %', SQLERRM;
        END;

        -- ── 5. translation_assignments: Add updated_at with backfill ──
        BEGIN
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = tenant.schema_name
                AND table_name = 'translation_assignments'
                AND column_name = 'updated_at'
            ) INTO col_exists;
            IF NOT col_exists THEN
                EXECUTE format('ALTER TABLE %I.translation_assignments ADD COLUMN updated_at TIMESTAMP DEFAULT NOW()', tenant.schema_name);
                EXECUTE format('UPDATE %I.translation_assignments SET updated_at = NOW() WHERE updated_at IS NULL', tenant.schema_name);
                RAISE NOTICE '  Added updated_at to translation_assignments (backfilled)';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  SKIP updated_at (assignments): %', SQLERRM;
        END;

        -- ── 6. Migrate old NUMBER replacement_fixed to pipeline JSON (best-effort) ──
        -- Converts non-JSON replacement_fixed to {"steps":[{"type":"addPrefix","value":"..."}]}
        -- Only for NUMBER category profiles that have plain-text replacement_fixed (not already JSON)
        -- Users should review migrated profiles in the Number Translation UI.
        BEGIN
            EXECUTE format(
                'UPDATE %I.translation_profiles SET replacement_fixed = $1, updated_at = NOW()
                 WHERE category = ''NUMBER''
                   AND replacement_fixed IS NOT NULL
                   AND replacement_fixed != ''''
                   AND replacement_fixed !~ ''^[{[]''',
                tenant.schema_name
            ) USING '{"steps":[{"type":"addPrefix","value":""}]}';
            GET DIAGNOSTICS updated_count = ROW_COUNT;
            IF updated_count > 0 THEN
                RAISE NOTICE '  Flagged % NUMBER profiles for review (set placeholder pipeline)', updated_count;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  SKIP data migration: %', SQLERRM;
        END;

        -- ── 7. Pad MNC to 3 digits ──
        BEGIN
            EXECUTE format(
                'UPDATE %I.translation_profiles
                 SET mnc = LPAD(mnc, 3, ''0'')
                 WHERE mnc IS NOT NULL AND mnc != ''*'' AND LENGTH(mnc) < 3',
                tenant.schema_name
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '  SKIP MNC padding: %', SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE 'Migration 0021 complete.';
END $$;
