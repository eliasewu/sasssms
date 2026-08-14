-- repair-voice-otp-id-sequences.sql — some tenant schemas were created with
-- voice_otp_config / voice_otp_audio tables whose `id` column has NO default
-- (no sequence). Any INSERT that doesn't name id then fails with
-- "null value in column id violates not-null constraint".
--
-- This heals every tenant schema on the server: for each of the listed tables,
-- if the id column lacks a default, create a per-table sequence, wire it as the
-- default, and sync it to MAX(id).

DO $$
DECLARE
  sch text;
  tbl text;
  seq_name text;
BEGIN
  FOR sch IN
    SELECT DISTINCT table_schema FROM information_schema.tables
    WHERE table_schema LIKE 'tenant_%' AND table_name = 'voice_otp_config'
  LOOP
    FOR tbl IN SELECT unnest(ARRAY['voice_otp_config', 'voice_otp_audio', 'voice_otp_sip_config'])
    LOOP
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = sch AND table_name = tbl
          AND column_name = 'id' AND is_identity = 'NO' AND column_default IS NULL
      ) THEN
        seq_name := sch || '_' || tbl || '_id_seq';
        EXECUTE format('DROP SEQUENCE IF EXISTS %I.%I CASCADE', sch, seq_name);
        EXECUTE format('CREATE SEQUENCE %I.%I OWNED BY %I.%I.id', sch, seq_name, sch, tbl);
        EXECUTE format(
          'ALTER TABLE %I.%I ALTER COLUMN id SET DEFAULT nextval(%L::regclass)',
          sch, tbl, sch || '.' || seq_name
        );
        EXECUTE format(
          'SELECT setval(%L::regclass, COALESCE((SELECT MAX(id) FROM %I.%I), 1), true)',
          sch || '.' || seq_name, sch, tbl
        );
        RAISE NOTICE 'repaired % . % .id', sch, tbl;
      END IF;
    END LOOP;
  END LOOP;
END $$;
