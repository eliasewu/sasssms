-- update-voice-otp-defaults.sql — point voice_otp_default_audio at the new
-- high-quality builtin audio (public/audio/builtin/<lang>/greeting.wav, 0.wav..9.wav).
-- Run on EVERY server (each has its own app_db + defaults table).
--
-- Language names MUST be title-case ('English', 'Arabic'...) — voice_otp_config
-- in tenant schemas uses title-case, and the seed matches case-sensitively.
-- File URLs use the lowercase builtin folder name (matches the engine's
-- fallback construction: /audio/builtin/<language.toLowerCase()>/<digit>.wav).

DO $$
DECLARE
  -- (title-case language, lowercase builtin folder)
  langs text[][] := ARRAY[
    ['English','english'],['Spanish','spanish'],['Arabic','arabic'],['French','french'],
    ['Portuguese','portuguese'],['Russian','russian'],['German','german'],['Italian','italian'],
    ['Dutch','dutch'],['Turkish','turkish'],['Hindi','hindi'],['Bangla','bangla'],
    ['Urdu','urdu'],['Indonesian','indonesian'],['Malay','malay'],['Filipino','filipino'],
    ['Thai','thai'],['Vietnamese','vietnamese'],['Mandarin','mandarin'],['Japanese','japanese'],
    ['Korean','korean'],['Cantonese','cantonese'],['Swahili','swahili'],['Polish','polish'],
    ['Swedish','swedish'],['Norwegian','norwegian'],['Danish','danish'],['Finnish','finnish'],
    ['Ukrainian','ukrainian'],['Romanian','romanian'],['Czech','czech'],['Hungarian','hungarian'],
    ['Greek','greek'],['Hebrew','hebrew'],['Persian','persian'],['Somali','somali'],
    ['Amharic','amharic'],['Burmese','burmese'],['Khmer','khmer'],['Nepali','nepali'],
    ['Sinhala','sinhala'],['Georgian','georgian'],['Armenian','armenian'],['Azerbaijani','azerbaijani'],
    ['Kazakh','kazakh'],['Uzbek','uzbek'],['Icelandic','icelandic'],['Estonian','estonian'],
    ['Latvian','latvian'],['Lithuanian','lithuanian'],['Bulgarian','bulgarian'],['Serbian','serbian'],
    ['Croatian','croatian'],['Slovak','slovak'],['Bosnian','bosnian'],['Albanian','albanian'],
    ['Maltese','maltese']
  ];
  lang_spec text[];
  lang_name text;
  folder text;
  digits text[] := ARRAY['greeting','0','1','2','3','4','5','6','7','8','9'];
  d text;
  canonical text[] := ARRAY[]::text[];
BEGIN
  -- 1. Build the canonical language name set
  FOREACH lang_spec SLICE 1 IN ARRAY langs
  LOOP
    canonical := canonical || lang_spec[1];
  END LOOP;

  -- 2. Delete any row whose language is NOT canonical (stray lowercase dupes
  --    from earlier runs, old unused languages, etc.)
  DELETE FROM voice_otp_default_audio
  WHERE NOT (language = ANY (canonical));

  -- 3. Dedupe within canonical languages: keep newest per (language, digit)
  DELETE FROM voice_otp_default_audio a
  WHERE a.id < (SELECT MAX(b.id) FROM voice_otp_default_audio b
                WHERE b.language = a.language AND b.digit = a.digit);

  -- 4. Upsert canonical rows (title-case language, lowercase folder URL)
  FOREACH lang_spec SLICE 1 IN ARRAY langs
  LOOP
    lang_name := lang_spec[1];
    folder := lang_spec[2];
    FOREACH d IN ARRAY digits
    LOOP
      UPDATE voice_otp_default_audio
      SET file_name = folder || '_' || d || '.wav',
          file_url  = '/audio/builtin/' || folder || '/' || d || '.wav',
          audio_type = 'wav'
      WHERE language = lang_name AND digit = d;
      IF NOT EXISTS (SELECT 1 FROM voice_otp_default_audio WHERE language = lang_name AND digit = d) THEN
        INSERT INTO voice_otp_default_audio (language, digit, file_name, file_url, audio_type)
        VALUES (lang_name, d, folder || '_' || d || '.wav', '/audio/builtin/' || folder || '/' || d || '.wav', 'wav');
      END IF;
    END LOOP;
  END LOOP;
  RAISE NOTICE 'defaults now: % rows (target %)', (SELECT COUNT(*) FROM voice_otp_default_audio), 57 * 11;
END $$;
