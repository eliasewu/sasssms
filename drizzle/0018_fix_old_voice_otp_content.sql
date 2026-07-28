-- Migration: Fix old Voice OTP messages to store only OTP digits in content
-- 
-- Before: content = "Your verification code is 458921. Valid for 5 minutes."
-- After:  content = "458921"
--         original_content = "Your verification code is 458921. Valid for 5 minutes."
--
-- This is a one-time data backfill for messages created before the code fix.
-- New messages already store just OTP digits via the code fix in send-sms/route.ts and smpp-server.ts.

DO $$
DECLARE
  t_rec RECORD;
  affected INT;
  total INT := 0;
BEGIN
  FOR t_rec IN SELECT schema_name FROM public.tenants WHERE is_active = true ORDER BY id LOOP
    EXECUTE format(
      'UPDATE "%s".messages SET 
         original_content = COALESCE(original_content, content),
         content = otp_code
       WHERE connection_type = ''VOICE_OTP'' 
         AND content IS DISTINCT FROM otp_code 
         AND otp_code IS NOT NULL',
      t_rec.schema_name
    );
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected > 0 THEN
      total := total + affected;
      RAISE NOTICE 'Fixed % messages in tenant: %', affected, t_rec.schema_name;
    END IF;
  END LOOP;
  RAISE NOTICE '---';
  RAISE NOTICE 'Total Voice OTP messages fixed: %', total;
END;
$$;

-- Verify: Show a few fixed records
SELECT schema_name, fixed_count FROM (
  SELECT t.schema_name, COUNT(*)::int as fixed_count
  FROM public.tenants t
  JOIN LATERAL (
    SELECT 1 FROM format('"%s".messages', t.schema_name) AS m
    WHERE m.connection_type = 'VOICE_OTP'
      AND m.content = m.otp_code
      AND m.original_content IS DISTINCT FROM m.content
    LIMIT 1
  ) AS chk ON true
  WHERE t.is_active = true
  GROUP BY t.schema_name
) sub ORDER BY fixed_count DESC;
