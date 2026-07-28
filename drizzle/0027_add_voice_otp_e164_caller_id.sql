-- Add caller_id_mode, e164_country_prefix, e164_format to voice_otp_sip_config
-- caller_id_mode: 'otp' (fixed text) | 'e164' (random number with country prefix)
-- e164_country_prefix: country dial code e.g. '+880', '+1'
-- e164_format: 'plus' (+880...) | 'none' (880...) | 'doubleZero' (00880...)
DO $$
DECLARE
    sch text;
BEGIN
    FOR sch IN
        SELECT t.schema_name FROM public.tenants t WHERE t.is_active = true
    LOOP
        BEGIN
            EXECUTE format('ALTER TABLE %I.voice_otp_sip_config ADD COLUMN IF NOT EXISTS caller_id_mode VARCHAR(10) DEFAULT ''otp''', sch);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping % — %', sch, SQLERRM;
        END;
        BEGIN
            EXECUTE format('ALTER TABLE %I.voice_otp_sip_config ADD COLUMN IF NOT EXISTS e164_country_prefix VARCHAR(10)', sch);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping % — %', sch, SQLERRM;
        END;
        BEGIN
            EXECUTE format('ALTER TABLE %I.voice_otp_sip_config ADD COLUMN IF NOT EXISTS e164_format VARCHAR(10) DEFAULT ''plus''', sch);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping % — %', sch, SQLERRM;
        END;
    END LOOP;
END $$;
