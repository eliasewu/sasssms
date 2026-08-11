-- Drop tenant schemas from the DEV box (15.235.35.125) whose tenant rows now
-- point at production servers. Their data was dumped to
-- /tmp/tenant-migration-backup and restored on the assigned production box
-- (verified table-count match). The dev box must not keep serving them.
DO $$
DECLARE
    r RECORD;
    dropped int := 0;
    skipped int := 0;
BEGIN
    FOR r IN
        SELECT t.schema_name
        FROM tenants t
        WHERE t.schema_name LIKE 'tenant_%'
          AND COALESCE(t.smpp_server_ip, '') NOT IN ('15.235.35.125', '', '0.0.0.0')
        ORDER BY t.schema_name
    LOOP
        BEGIN
            EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', r.schema_name);
            dropped := dropped + 1;
            RAISE NOTICE 'DROPPED %', r.schema_name;
        EXCEPTION WHEN OTHERS THEN
            skipped := skipped + 1;
            RAISE NOTICE 'SKIPPED %: %', r.schema_name, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE 'Done: dropped=%, skipped=%', dropped, skipped;
END $$;
