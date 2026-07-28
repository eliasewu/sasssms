-- Add language_mode to voice_otp_config (per-tenant table)
-- local = primary language with English fallback
-- dual = bilingual concatenation in one call
-- international = English only
DO $$
DECLARE
    sch text;
BEGIN
    FOR sch IN
        SELECT t.schema_name FROM public.tenants t WHERE t.is_active = true
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I.voice_otp_config ADD COLUMN IF NOT EXISTS language_mode VARCHAR(20) DEFAULT ''local''', sch);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping % — %', sch, SQLERRM;
        END;
        BEGIN
            EXECUTE format('ALTER TABLE %I.voice_otp_sip_config ADD COLUMN IF NOT EXISTS dial_prefix VARCHAR(20)', sch);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping % — %', sch, SQLERRM;
        END;
    END LOOP;
END $$;
