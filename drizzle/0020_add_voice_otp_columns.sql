-- Migration 0020: Add missing Voice OTP columns to existing tenant schemas
-- Fixes gap #4 & #5 from the Voice OTP audit:
--   - voice_otp_call_logs: sip_config_id, sip_config_name, call_sid, country, mcc, audio_playlist, attempt_log
--   - tenants (public): max_concurrent_calls
-- Safe: uses ADD COLUMN IF NOT EXISTS (Postgres 9.6+), so it's idempotent.
DO $$
DECLARE
  tenant RECORD;
  col_exists BOOLEAN;
BEGIN
  -- ── 1. Add max_concurrent_calls to public tenants table ──
  BEGIN
    ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS max_concurrent_calls INTEGER DEFAULT 10;
    RAISE NOTICE 'Migration 0020: Added max_concurrent_calls to tenants (public)';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Migration 0020: Could not add max_concurrent_calls to tenants — %', SQLERRM;
  END;

  -- ── 2. Add missing columns to every tenant's voice_otp_call_logs ──
  FOR tenant IN SELECT schema_name FROM public.tenants WHERE is_active = true
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I.voice_otp_call_logs ADD COLUMN IF NOT EXISTS sip_config_id INTEGER', tenant.schema_name);
      EXECUTE format('ALTER TABLE %I.voice_otp_call_logs ADD COLUMN IF NOT EXISTS sip_config_name VARCHAR(255)', tenant.schema_name);
      EXECUTE format('ALTER TABLE %I.voice_otp_call_logs ADD COLUMN IF NOT EXISTS call_sid VARCHAR(100)', tenant.schema_name);
      EXECUTE format('ALTER TABLE %I.voice_otp_call_logs ADD COLUMN IF NOT EXISTS country VARCHAR(100)', tenant.schema_name);
      EXECUTE format('ALTER TABLE %I.voice_otp_call_logs ADD COLUMN IF NOT EXISTS mcc VARCHAR(10)', tenant.schema_name);
      EXECUTE format('ALTER TABLE %I.voice_otp_call_logs ADD COLUMN IF NOT EXISTS audio_playlist TEXT', tenant.schema_name);
      EXECUTE format('ALTER TABLE %I.voice_otp_call_logs ADD COLUMN IF NOT EXISTS attempt_log TEXT', tenant.schema_name);
      RAISE NOTICE 'Migration 0020: Updated voice_otp_call_logs for %', tenant.schema_name;
    EXCEPTION WHEN OTHERS THEN
      -- Table may not exist (tenant never used voice OTP), skip
      RAISE NOTICE 'Migration 0020: Skipped % — %', tenant.schema_name, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Migration 0020: Complete.';
END
$$;
