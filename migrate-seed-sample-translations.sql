-- migrate-seed-sample-translations.sql
-- Seeds 6 sample translation profiles for ALL active tenants that don't have them.
-- Uses format() with %L specifiers for safe value quoting.
-- Run: PGPASSWORD=postgres psql -h 127.0.0.1 -U postgres -d app_db -f migrate-seed-sample-translations.sql

DO $$
DECLARE
    t RECORD;
    pid INTEGER;
BEGIN
    FOR t IN SELECT id, schema_name, company_name FROM tenants WHERE is_active = true ORDER BY id
    LOOP
        RAISE NOTICE '[%] %', t.id, t.company_name;

        ----- 1. SID Translation -----
        BEGIN
            EXECUTE format('SELECT COUNT(*) FROM %I.translation_profiles WHERE name = %L', t.schema_name, 'Sample SID Replace') INTO pid;
            IF pid = 0 THEN
                EXECUTE format('
                    INSERT INTO %I.translation_profiles (name, target_field, mode, category, match_pattern, replacement_fixed, sort_order, is_active)
                    VALUES (%L, %L, %L, %L, %L, %L, 0, true) RETURNING id',
                    t.schema_name, 'Sample SID Replace', 'SENDER', 'FIXED', 'SID', '.*', 'MyBrand'
                ) INTO pid;
                EXECUTE format('INSERT INTO %I.translation_assignments (profile_id, priority, is_active) VALUES ($1, 1, true)', t.schema_name) USING pid;
                RAISE NOTICE '  ✅ SID Replace (id=%)', pid;
            END IF;
        EXCEPTION WHEN OTHERS THEN RAISE NOTICE '  ⚠️ SID: %', SQLERRM; END;

        ----- 2. Number Translation -----
        BEGIN
            EXECUTE format('SELECT COUNT(*) FROM %I.translation_profiles WHERE name = %L', t.schema_name, 'Sample BD Number Strip') INTO pid;
            IF pid = 0 THEN
                EXECUTE format('
                    INSERT INTO %I.translation_profiles (name, target_field, mode, category, match_pattern, replacement_fixed, mcc, sort_order, is_active)
                    VALUES (%L, %L, %L, %L, %L, %L, %L, 0, true) RETURNING id',
                    t.schema_name,
                    'Sample BD Number Strip', 'DESTINATION', 'FIXED', 'NUMBER', '.*',
                    '{"steps":[{"type":"stripDigits","value":"2"},{"type":"removePrefix","value":"+880"},{"type":"addPrefix","value":"0"}]}',
                    '470'
                ) INTO pid;
                EXECUTE format('INSERT INTO %I.translation_assignments (profile_id, priority, is_active) VALUES ($1, 1, true)', t.schema_name) USING pid;
                RAISE NOTICE '  ✅ Number Strip (id=%)', pid;
            END IF;
        EXCEPTION WHEN OTHERS THEN RAISE NOTICE '  ⚠️ Number: %', SQLERRM; END;

        ----- 3. Content Translation -----
        BEGIN
            EXECUTE format('SELECT COUNT(*) FROM %I.translation_profiles WHERE name = %L', t.schema_name, 'Sample Keyword Replace') INTO pid;
            IF pid = 0 THEN
                EXECUTE format('
                    INSERT INTO %I.translation_profiles (name, target_field, mode, category, match_pattern, replacement_fixed, sort_order, is_active)
                    VALUES (%L, %L, %L, %L, %L, %L, 0, true) RETURNING id',
                    t.schema_name, 'Sample Keyword Replace', 'BODY', 'FIXED', 'CONTENT', 'facebook|FB', 'verify'
                ) INTO pid;
                EXECUTE format('INSERT INTO %I.translation_assignments (profile_id, priority, is_active) VALUES ($1, 1, true)', t.schema_name) USING pid;
                RAISE NOTICE '  ✅ Keyword Replace (id=%)', pid;
            END IF;
        EXCEPTION WHEN OTHERS THEN RAISE NOTICE '  ⚠️ Content: %', SQLERRM; END;

        ----- 4. Random Content -----
        BEGIN
            EXECUTE format('SELECT COUNT(*) FROM %I.translation_profiles WHERE name = %L', t.schema_name, 'Sample Random OTP Templates') INTO pid;
            IF pid = 0 THEN
                EXECUTE format('
                    INSERT INTO %I.translation_profiles (name, target_field, mode, category, match_pattern, mcc, sort_order, is_active)
                    VALUES (%L, %L, %L, %L, %L, %L, 0, true) RETURNING id',
                    t.schema_name, 'Sample Random OTP Templates', 'BODY', 'RANDOM', 'RANDOM_CONTENT', '.*', '470'
                ) INTO pid;
                EXECUTE format('INSERT INTO %I.translation_pool_items (profile_id, replacement_value) VALUES ($1, %L)', t.schema_name, 'Your OTP code is {{OTP}}. Valid for 5 min.') USING pid;
                EXECUTE format('INSERT INTO %I.translation_pool_items (profile_id, replacement_value) VALUES ($1, %L)', t.schema_name, 'Verification code: {{OTP}}') USING pid;
                EXECUTE format('INSERT INTO %I.translation_pool_items (profile_id, replacement_value) VALUES ($1, %L)', t.schema_name, '{{OTP}} is your one-time password') USING pid;
                EXECUTE format('INSERT INTO %I.translation_pool_items (profile_id, replacement_value) VALUES ($1, %L)', t.schema_name, 'OTP: {{OTP}}. Do not share.') USING pid;
                EXECUTE format('INSERT INTO %I.translation_assignments (profile_id, priority, is_active) VALUES ($1, 1, true)', t.schema_name) USING pid;
                RAISE NOTICE '  ✅ Random OTP Templates (id=%)', pid;
            END IF;
        EXCEPTION WHEN OTHERS THEN RAISE NOTICE '  ⚠️ Random Content: %', SQLERRM; END;

        ----- 5. Random SID -----
        BEGIN
            EXECUTE format('SELECT COUNT(*) FROM %I.translation_profiles WHERE name = %L', t.schema_name, 'Sample Random SID') INTO pid;
            IF pid = 0 THEN
                EXECUTE format('
                    INSERT INTO %I.translation_profiles (name, target_field, mode, category, match_pattern, mcc, sort_order, is_active)
                    VALUES (%L, %L, %L, %L, %L, %L, 0, true) RETURNING id',
                    t.schema_name, 'Sample Random SID', 'SENDER', 'RANDOM', 'RANDOM_SID', '.*', '470'
                ) INTO pid;
                EXECUTE format('INSERT INTO %I.translation_pool_items (profile_id, replacement_value) VALUES ($1, %L)', t.schema_name, 'BrandSID1') USING pid;
                EXECUTE format('INSERT INTO %I.translation_pool_items (profile_id, replacement_value) VALUES ($1, %L)', t.schema_name, 'BrandSID2') USING pid;
                EXECUTE format('INSERT INTO %I.translation_pool_items (profile_id, replacement_value) VALUES ($1, %L)', t.schema_name, 'BrandSID3') USING pid;
                EXECUTE format('INSERT INTO %I.translation_assignments (profile_id, priority, is_active) VALUES ($1, 1, true)', t.schema_name) USING pid;
                RAISE NOTICE '  ✅ Random SID (id=%)', pid;
            END IF;
        EXCEPTION WHEN OTHERS THEN RAISE NOTICE '  ⚠️ Random SID: %', SQLERRM; END;

        ----- 6. OTP Extract Rule -----
        BEGIN
            EXECUTE format('SELECT COUNT(*) FROM %I.otp_extract_rules WHERE name = %L', t.schema_name, 'Sample OTP Auto-Extract') INTO pid;
            IF pid = 0 THEN
                EXECUTE format('
                    INSERT INTO %I.otp_extract_rules (name, regex_pattern, otp_group_index, forward_template, auto_detect, sort_order, is_active)
                    VALUES (%L, %L, 1, %L, true, 0, true)',
                    t.schema_name, 'Sample OTP Auto-Extract', '(\\d{4,8})', '{otp}'
                );
                RAISE NOTICE '  ✅ OTP Auto-Extract';
            ELSE
                RAISE NOTICE '  ⏭️ OTP Auto-Extract already exists';
            END IF;
        EXCEPTION WHEN OTHERS THEN RAISE NOTICE '  ⚠️ OTP Extract: %', SQLERRM; END;

    END LOOP;
END $$;
