-- Seed default Voice OTP language groups into all existing tenant schemas
-- All countries speaking the same language are now in ONE group
-- Run after deploy to ensure every tenant has the pre-configured languages
DO $seed$
DECLARE
  tenant RECORD;
  row_count INTEGER;
BEGIN
  FOR tenant IN SELECT schema_name FROM tenants WHERE is_active = true
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I.voice_otp_config', tenant.schema_name) INTO row_count;
    
    IF row_count = 0 THEN
      EXECUTE format($ins$
        INSERT INTO %I.voice_otp_config (country_group, prefixes, primary_language, secondary_language, is_active) VALUES
        ('English', '+1,+44,+61,+64,+65,+27,+234,+233,+353,+220,+231,+232,+248,+250,+258,+260,+263,+264,+265,+267,+27,+290,+353,+65,+230', 'English', 'Spanish', true),
        ('Spanish', '+34,+52,+54,+57,+56,+51,+58,+53,+502,+503,+504,+505,+506,+507,+591,+593,+595,+598', 'Spanish', 'English', true),
        ('Arabic', '+966,+971,+962,+20,+213,+216,+218,+249,+253,+963,+964,+965,+967,+968,+970,+973,+974,+212,+222', 'Arabic', 'English', true),
        ('French', '+33,+32,+41,+226,+227,+228,+229,+235,+237,+241,+242,+243,+245,+250,+257,+262,+269,+509,+590,+594,+596,+689,+221,+223,+224,+225', 'French', 'English', true),
        ('Portuguese', '+351,+55,+238,+239,+244,+258,+853', 'Portuguese', 'English', true),
        ('Russian', '+7,+375,+380,+992,+993,+996,+998', 'Russian', 'English', true),
        ('German', '+49,+43,+41,+423,+352', 'German', 'English', true),
        ('Italian', '+39,+378', 'Italian', 'English', true),
        ('Dutch', '+31,+32,+297,+599', 'Dutch', 'English', true),
        ('Turkish', '+90', 'Turkish', 'English', true),
        ('Hindi', '+91', 'Hindi', 'English', true),
        ('Bangla', '+880', 'Bangla', 'English', true),
        ('Urdu', '+92', 'Urdu', 'English', true),
        ('Indonesian', '+62', 'Indonesian', 'English', true),
        ('Malay', '+60,+673', 'Malay', 'English', true),
        ('Filipino', '+63', 'Filipino', 'English', true),
        ('Thai', '+66', 'Thai', 'English', true),
        ('Vietnamese', '+84', 'Vietnamese', 'English', true),
        ('Mandarin', '+86,+886', 'Mandarin', 'English', true),
        ('Japanese', '+81', 'Japanese', 'English', true),
        ('Korean', '+82,+850', 'Korean', 'English', true),
        ('Cantonese', '+852,+853', 'Cantonese', 'English', true),
        ('Swahili', '+254,+255,+250', 'Swahili', 'English', true),
        ('Polish', '+48', 'Polish', 'English', true),
        ('Swedish', '+46', 'Swedish', 'English', true),
        ('Norwegian', '+47', 'Norwegian', 'English', true),
        ('Danish', '+45', 'Danish', 'English', true),
        ('Finnish', '+358', 'Finnish', 'English', true),
        ('Ukrainian', '+380', 'Ukrainian', 'English', true),
        ('Romanian', '+40,+373', 'Romanian', 'English', true),
        ('Czech', '+420', 'Czech', 'English', true),
        ('Hungarian', '+36', 'Hungarian', 'English', true),
        ('Greek', '+30,+357', 'Greek', 'English', true),
        ('Hebrew', '+972', 'Hebrew', 'English', true),
        ('Persian', '+98', 'Persian', 'English', true),
        ('Somali', '+252', 'Somali', 'English', true),
        ('Amharic', '+251', 'Amharic', 'English', true),
        ('Burmese', '+95', 'Burmese', 'English', true),
        ('Khmer', '+855', 'Khmer', 'English', true),
        ('Nepali', '+977', 'Nepali', 'English', true),
        ('Sinhala', '+94', 'Sinhala', 'English', true),
        ('Lao', '+856', 'Lao', 'English', true),
        ('Mongolian', '+976', 'Mongolian', 'English', true),
        ('Georgian', '+995', 'Georgian', 'English', true),
        ('Armenian', '+374', 'Armenian', 'English', true),
        ('Azerbaijani', '+994', 'Azerbaijani', 'English', true),
        ('Kazakh', '+7', 'Kazakh', 'English', true),
        ('Uzbek', '+998', 'Uzbek', 'English', true),
        ('Icelandic', '+354', 'Icelandic', 'English', true),
        ('Estonian', '+372', 'Estonian', 'English', true),
        ('Latvian', '+371', 'Latvian', 'English', true),
        ('Lithuanian', '+370', 'Lithuanian', 'English', true),
        ('Bulgarian', '+359', 'Bulgarian', 'English', true),
        ('Serbian', '+381', 'Serbian', 'English', true),
        ('Croatian', '+385', 'Croatian', 'English', true),
        ('Slovenian', '+386', 'Slovenian', 'English', true),
        ('Slovak', '+421', 'Slovak', 'English', true),
        ('Bosnian', '+387', 'Bosnian', 'English', true),
        ('Macedonian', '+389', 'Macedonian', 'English', true),
        ('Albanian', '+355', 'Albanian', 'English', true),
        ('Maltese', '+356', 'Maltese', 'English', true),
        ('Luxembourgish', '+352', 'Luxembourgish', 'English', true),
        ('Samoan', '+685', 'Samoan', 'English', true),
        ('Tongan', '+676', 'Tongan', 'English', true),
        ('Fijian', '+679', 'Fijian', 'English', true)
      $ins$, tenant.schema_name);
      
      RAISE NOTICE 'Seeded Voice OTP languages (grouped by language) into %', tenant.schema_name;
    ELSE
      RAISE NOTICE 'Skipped % — already has % language group(s)', tenant.schema_name, row_count;
    END IF;
  END LOOP;
END
$seed$;
