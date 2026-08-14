-- seed-voice-otp-defaults-to-tenants.sql — push the (updated) voice_otp_default_audio
-- into EVERY tenant schema's voice_otp_audio, mirroring the production
-- seedDefaultsToTenants() logic in src/app/api/super/voice-otp-defaults/route.ts:
--   * match each default to every voice_otp_config whose primary/secondary
--     language matches the default's language (create a config if none)
--   * upsert audio rows keyed on (config_id, language, digit)
-- Run on EVERY server (each has its own tenants table + tenant schemas).

DO $$
DECLARE
  s RECORD;
  lang_digit RECORD;
  cfg RECORD;
  cfg_id INT;
  lang_count INT;
BEGIN
  FOR s IN
    -- Only touch schemas that actually EXIST on this server: the tenants table
    -- is replicated to every server, but each server only hosts a subset of
    -- tenant schemas (missing ones would raise "relation does not exist").
    SELECT t.schema_name
    FROM tenants t
    JOIN pg_namespace n ON n.nspname = t.schema_name
    WHERE t.is_active = true
      AND t.schema_name LIKE 'tenant_%'
      AND EXISTS (
        SELECT 1 FROM information_schema.tables tbl
        WHERE tbl.table_schema = t.schema_name AND tbl.table_name = 'voice_otp_audio'
      )
  LOOP
    -- ensure voice_otp_audio unique index exists (heal-style, safe)
    BEGIN
      EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS voice_otp_audio_uniq ON %I.voice_otp_audio (config_id, language, digit)', s.schema_name);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'index failed for %: %', s.schema_name, SQLERRM;
    END;

    -- dedupe: keep the newest row per (config_id, language, digit)
    EXECUTE format(
      'DELETE FROM %I.voice_otp_audio a
       WHERE a.id < (SELECT MAX(b.id) FROM %I.voice_otp_audio b
                     WHERE b.config_id = a.config_id AND b.language = a.language AND b.digit = a.digit)',
      s.schema_name, s.schema_name
    );

    FOR lang_digit IN
      SELECT language, digit, file_name, file_url, COALESCE(audio_type,'wav') AS audio_type
      FROM voice_otp_default_audio
      WHERE file_url LIKE '/audio/builtin/%'
      ORDER BY language, digit
    LOOP
      -- Match all configs where this language is primary or secondary
      FOR cfg IN
        EXECUTE format(
          'SELECT id FROM %I.voice_otp_config
           WHERE primary_language = $1 OR secondary_language = $1
           ORDER BY (primary_language = $1) DESC, id ASC',
          s.schema_name
        ) USING lang_digit.language
      LOOP
        EXECUTE format(
          'INSERT INTO %I.voice_otp_audio (config_id, language, digit, file_name, file_url, audio_type)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (config_id, language, digit)
           DO UPDATE SET file_name = EXCLUDED.file_name, file_url = EXCLUDED.file_url, audio_type = EXCLUDED.audio_type',
          s.schema_name
        ) USING cfg.id, lang_digit.language, lang_digit.digit, lang_digit.file_name, lang_digit.file_url, lang_digit.audio_type;
      END LOOP;

      -- No config matched for this language → create one (once per language)
      EXECUTE format(
        'SELECT COUNT(*) FROM %I.voice_otp_config WHERE primary_language = $1 OR secondary_language = $1',
        s.schema_name
      ) INTO lang_count USING lang_digit.language;
      IF lang_count = 0 THEN
        EXECUTE format(
          'INSERT INTO %I.voice_otp_config (country_group, prefixes, primary_language, secondary_language, bilingual)
           VALUES ($1, $2, $1, ''English'', false) RETURNING id',
          s.schema_name
        ) INTO cfg_id USING lang_digit.language, lang_digit.language;
        -- insert the 11 defaults for this language in one pass
        EXECUTE format(
          'INSERT INTO %I.voice_otp_audio (config_id, language, digit, file_name, file_url, audio_type)
           SELECT $1, language, digit, file_name, file_url, audio_type
           FROM voice_otp_default_audio
           WHERE language = $2 AND file_url LIKE ''/audio/builtin/%%''',
          s.schema_name
        ) USING cfg_id, lang_digit.language;
      END IF;
    END LOOP;

    -- refresh audio counts
    BEGIN
      EXECUTE format(
        'UPDATE %I.voice_otp_config c SET
          primary_audio_count = (SELECT COUNT(*) FROM %I.voice_otp_audio a WHERE a.config_id = c.id AND a.language = c.primary_language),
          secondary_audio_count = (SELECT COUNT(*) FROM %I.voice_otp_audio a WHERE a.config_id = c.id AND a.language = c.secondary_language)',
        s.schema_name, s.schema_name, s.schema_name
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'audio count refresh failed for %: %', s.schema_name, SQLERRM;
    END;
  END LOOP;
END $$;
