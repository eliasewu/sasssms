-- Migration: Extend mcc_mnc_prefix_map seed with more countries
--
-- Adds phone-number-prefix → MNC mappings for additional high-volume markets so
-- operator-specific rate lookup (lookupMccMnc → matchRate) resolves correctly.
--
-- MNC values are stored zero-padded to 3 digits to match mcc_mnc_database.mnc
-- (the source of truth that populates client_rates / supplier_rates).
-- prefix = local number prefix AFTER the country code (and trunk "0") is stripped,
-- matching lookupMccMnc's `normalizedLocal`.
--
-- Idempotent: ON CONFLICT on the existing unique index (mcc, mnc, prefix).

-- Indonesia (MCC 510)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('510', '010', '811', 'Indonesia', 'Telkomsel'),
  ('510', '010', '812', 'Indonesia', 'Telkomsel'),
  ('510', '010', '813', 'Indonesia', 'Telkomsel'),
  ('510', '010', '821', 'Indonesia', 'Telkomsel'),
  ('510', '010', '822', 'Indonesia', 'Telkomsel'),
  ('510', '010', '823', 'Indonesia', 'Telkomsel'),
  ('510', '010', '851', 'Indonesia', 'Telkomsel'),
  ('510', '010', '852', 'Indonesia', 'Telkomsel'),
  ('510', '010', '853', 'Indonesia', 'Telkomsel'),
  ('510', '001', '814', 'Indonesia', 'Indosat Ooredoo'),
  ('510', '001', '815', 'Indonesia', 'Indosat Ooredoo'),
  ('510', '001', '816', 'Indonesia', 'Indosat Ooredoo'),
  ('510', '001', '855', 'Indonesia', 'Indosat Ooredoo'),
  ('510', '001', '856', 'Indonesia', 'Indosat Ooredoo'),
  ('510', '001', '857', 'Indonesia', 'Indosat Ooredoo'),
  ('510', '001', '858', 'Indonesia', 'Indosat Ooredoo'),
  ('510', '011', '817', 'Indonesia', 'XL Axiata'),
  ('510', '011', '818', 'Indonesia', 'XL Axiata'),
  ('510', '011', '819', 'Indonesia', 'XL Axiata'),
  ('510', '011', '859', 'Indonesia', 'XL Axiata'),
  ('510', '011', '877', 'Indonesia', 'XL Axiata'),
  ('510', '011', '878', 'Indonesia', 'XL Axiata'),
  ('510', '009', '881', 'Indonesia', 'Smartfren'),
  ('510', '009', '882', 'Indonesia', 'Smartfren'),
  ('510', '009', '883', 'Indonesia', 'Smartfren'),
  ('510', '009', '884', 'Indonesia', 'Smartfren'),
  ('510', '009', '885', 'Indonesia', 'Smartfren'),
  ('510', '009', '886', 'Indonesia', 'Smartfren'),
  ('510', '009', '887', 'Indonesia', 'Smartfren'),
  ('510', '009', '888', 'Indonesia', 'Smartfren'),
  ('510', '009', '889', 'Indonesia', 'Smartfren'),
  ('510', '008', '831', 'Indonesia', 'Axis'),
  ('510', '008', '832', 'Indonesia', 'Axis'),
  ('510', '008', '833', 'Indonesia', 'Axis'),
  ('510', '008', '838', 'Indonesia', 'Axis'),
  ('510', '089', '895', 'Indonesia', 'Three (H3G)'),
  ('510', '089', '896', 'Indonesia', 'Three (H3G)'),
  ('510', '089', '897', 'Indonesia', 'Three (H3G)'),
  ('510', '089', '898', 'Indonesia', 'Three (H3G)'),
  ('510', '089', '899', 'Indonesia', 'Three (H3G)')
ON CONFLICT (mcc, mnc, prefix) DO NOTHING;

-- Philippines (MCC 515)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('515', '001', '917', 'Philippines', 'Globe Telecom'),
  ('515', '001', '915', 'Philippines', 'Globe Telecom'),
  ('515', '001', '905', 'Philippines', 'Globe Telecom'),
  ('515', '001', '906', 'Philippines', 'Globe Telecom'),
  ('515', '001', '926', 'Philippines', 'Globe Telecom'),
  ('515', '001', '927', 'Philippines', 'Globe Telecom'),
  ('515', '001', '935', 'Philippines', 'Globe Telecom'),
  ('515', '001', '936', 'Philippines', 'Globe Telecom'),
  ('515', '001', '937', 'Philippines', 'Globe Telecom'),
  ('515', '001', '995', 'Philippines', 'Globe Telecom'),
  ('515', '001', '996', 'Philippines', 'Globe Telecom'),
  ('515', '001', '997', 'Philippines', 'Globe Telecom'),
  ('515', '003', '918', 'Philippines', 'Smart'),
  ('515', '003', '919', 'Philippines', 'Smart'),
  ('515', '003', '920', 'Philippines', 'Smart'),
  ('515', '003', '921', 'Philippines', 'Smart'),
  ('515', '003', '928', 'Philippines', 'Smart'),
  ('515', '003', '929', 'Philippines', 'Smart'),
  ('515', '003', '947', 'Philippines', 'Smart'),
  ('515', '003', '948', 'Philippines', 'Smart'),
  ('515', '003', '949', 'Philippines', 'Smart'),
  ('515', '003', '998', 'Philippines', 'Smart'),
  ('515', '003', '999', 'Philippines', 'Smart'),
  ('515', '005', '922', 'Philippines', 'Sun/Smart'),
  ('515', '005', '923', 'Philippines', 'Sun/Smart'),
  ('515', '005', '925', 'Philippines', 'Sun/Smart'),
  ('515', '005', '932', 'Philippines', 'Sun/Smart'),
  ('515', '005', '933', 'Philippines', 'Sun/Smart'),
  ('515', '005', '934', 'Philippines', 'Sun/Smart'),
  ('515', '005', '942', 'Philippines', 'Sun/Smart'),
  ('515', '005', '943', 'Philippines', 'Sun/Smart')
ON CONFLICT (mcc, mnc, prefix) DO NOTHING;

-- Saudi Arabia (MCC 420)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('420', '001', '50', 'Saudi Arabia', 'STC'),
  ('420', '001', '53', 'Saudi Arabia', 'STC'),
  ('420', '001', '55', 'Saudi Arabia', 'STC'),
  ('420', '002', '54', 'Saudi Arabia', 'Mobily'),
  ('420', '002', '56', 'Saudi Arabia', 'Mobily'),
  ('420', '002', '58', 'Saudi Arabia', 'Mobily'),
  ('420', '004', '57', 'Saudi Arabia', 'Zain'),
  ('420', '004', '59', 'Saudi Arabia', 'Zain')
ON CONFLICT (mcc, mnc, prefix) DO NOTHING;

-- United Arab Emirates (MCC 424)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('424', '002', '50', 'United Arab Emirates', 'Etisalat'),
  ('424', '002', '54', 'United Arab Emirates', 'Etisalat'),
  ('424', '002', '56', 'United Arab Emirates', 'Etisalat'),
  ('424', '003', '52', 'United Arab Emirates', 'du'),
  ('424', '003', '55', 'United Arab Emirates', 'du'),
  ('424', '003', '58', 'United Arab Emirates', 'du')
ON CONFLICT (mcc, mnc, prefix) DO NOTHING;

-- Egypt (MCC 602)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('602', '002', '10', 'Egypt', 'Vodafone'),
  ('602', '002', '100', 'Egypt', 'Vodafone'),
  ('602', '001', '12', 'Egypt', 'Orange'),
  ('602', '001', '120', 'Egypt', 'Orange'),
  ('602', '001', '122', 'Egypt', 'Orange'),
  ('602', '003', '11', 'Egypt', 'Etisalat'),
  ('602', '003', '110', 'Egypt', 'Etisalat'),
  ('602', '003', '111', 'Egypt', 'Etisalat'),
  ('602', '003', '114', 'Egypt', 'Etisalat'),
  ('602', '004', '15', 'Egypt', 'WE (Telecom Egypt)'),
  ('602', '004', '150', 'Egypt', 'WE (Telecom Egypt)'),
  ('602', '004', '155', 'Egypt', 'WE (Telecom Egypt)')
ON CONFLICT (mcc, mnc, prefix) DO NOTHING;

-- Kenya (MCC 639)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('639', '001', '70', 'Kenya', 'Safaricom'),
  ('639', '001', '71', 'Kenya', 'Safaricom'),
  ('639', '001', '72', 'Kenya', 'Safaricom'),
  ('639', '001', '74', 'Kenya', 'Safaricom'),
  ('639', '001', '75', 'Kenya', 'Safaricom'),
  ('639', '001', '76', 'Kenya', 'Safaricom'),
  ('639', '001', '79', 'Kenya', 'Safaricom'),
  ('639', '001', '11', 'Kenya', 'Safaricom'),
  ('639', '003', '73', 'Kenya', 'Airtel'),
  ('639', '003', '78', 'Kenya', 'Airtel'),
  ('639', '003', '10', 'Kenya', 'Airtel'),
  ('639', '007', '77', 'Kenya', 'Telkom Kenya')
ON CONFLICT (mcc, mnc, prefix) DO NOTHING;

-- South Africa (MCC 655)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('655', '001', '82', 'South Africa', 'Vodacom'),
  ('655', '001', '76', 'South Africa', 'Vodacom'),
  ('655', '001', '79', 'South Africa', 'Vodacom'),
  ('655', '010', '83', 'South Africa', 'MTN'),
  ('655', '010', '63', 'South Africa', 'MTN'),
  ('655', '010', '73', 'South Africa', 'MTN'),
  ('655', '010', '78', 'South Africa', 'MTN'),
  ('655', '007', '84', 'South Africa', 'Cell C'),
  ('655', '007', '74', 'South Africa', 'Cell C'),
  ('655', '002', '81', 'South Africa', 'Telkom'),
  ('655', '002', '61', 'South Africa', 'Telkom')
ON CONFLICT (mcc, mnc, prefix) DO NOTHING;

-- Ethiopia (MCC 636)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('636', '001', '91', 'Ethiopia', 'Ethio Telecom'),
  ('636', '001', '92', 'Ethiopia', 'Ethio Telecom'),
  ('636', '001', '93', 'Ethiopia', 'Ethio Telecom'),
  ('636', '001', '94', 'Ethiopia', 'Ethio Telecom'),
  ('636', '001', '97', 'Ethiopia', 'Ethio Telecom')
ON CONFLICT (mcc, mnc, prefix) DO NOTHING;

-- Ghana (MCC 620)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('620', '001', '24', 'Ghana', 'MTN'),
  ('620', '001', '25', 'Ghana', 'MTN'),
  ('620', '001', '54', 'Ghana', 'MTN'),
  ('620', '001', '55', 'Ghana', 'MTN'),
  ('620', '001', '59', 'Ghana', 'MTN'),
  ('620', '002', '20', 'Ghana', 'Vodafone'),
  ('620', '002', '50', 'Ghana', 'Vodafone'),
  ('620', '003', '26', 'Ghana', 'AirtelTigo'),
  ('620', '003', '27', 'Ghana', 'AirtelTigo'),
  ('620', '003', '57', 'Ghana', 'AirtelTigo')
ON CONFLICT (mcc, mnc, prefix) DO NOTHING;

-- Malaysia (MCC 502)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('502', '012', '12', 'Malaysia', 'Maxis'),
  ('502', '012', '17', 'Malaysia', 'Maxis'),
  ('502', '012', '111', 'Malaysia', 'Maxis'),
  ('502', '013', '13', 'Malaysia', 'Celcom'),
  ('502', '013', '19', 'Malaysia', 'Celcom'),
  ('502', '013', '113', 'Malaysia', 'Celcom'),
  ('502', '010', '16', 'Malaysia', 'DiGi'),
  ('502', '010', '10', 'Malaysia', 'DiGi'),
  ('502', '010', '112', 'Malaysia', 'DiGi'),
  ('502', '018', '18', 'Malaysia', 'U Mobile')
ON CONFLICT (mcc, mnc, prefix) DO NOTHING;

-- Vietnam (MCC 452)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('452', '004', '96', 'Vietnam', 'Viettel'),
  ('452', '004', '97', 'Vietnam', 'Viettel'),
  ('452', '004', '98', 'Vietnam', 'Viettel'),
  ('452', '004', '86', 'Vietnam', 'Viettel'),
  ('452', '004', '32', 'Vietnam', 'Viettel'),
  ('452', '004', '33', 'Vietnam', 'Viettel'),
  ('452', '004', '34', 'Vietnam', 'Viettel'),
  ('452', '004', '35', 'Vietnam', 'Viettel'),
  ('452', '004', '36', 'Vietnam', 'Viettel'),
  ('452', '004', '37', 'Vietnam', 'Viettel'),
  ('452', '004', '38', 'Vietnam', 'Viettel'),
  ('452', '004', '39', 'Vietnam', 'Viettel'),
  ('452', '002', '91', 'Vietnam', 'VinaPhone'),
  ('452', '002', '94', 'Vietnam', 'VinaPhone'),
  ('452', '002', '81', 'Vietnam', 'VinaPhone'),
  ('452', '002', '82', 'Vietnam', 'VinaPhone'),
  ('452', '002', '83', 'Vietnam', 'VinaPhone'),
  ('452', '002', '84', 'Vietnam', 'VinaPhone'),
  ('452', '002', '85', 'Vietnam', 'VinaPhone'),
  ('452', '002', '88', 'Vietnam', 'VinaPhone'),
  ('452', '001', '90', 'Vietnam', 'MobiFone'),
  ('452', '001', '93', 'Vietnam', 'MobiFone'),
  ('452', '001', '89', 'Vietnam', 'MobiFone'),
  ('452', '001', '70', 'Vietnam', 'MobiFone'),
  ('452', '001', '76', 'Vietnam', 'MobiFone'),
  ('452', '001', '77', 'Vietnam', 'MobiFone'),
  ('452', '001', '78', 'Vietnam', 'MobiFone'),
  ('452', '001', '79', 'Vietnam', 'MobiFone'),
  ('452', '005', '92', 'Vietnam', 'Vietnamobile'),
  ('452', '005', '52', 'Vietnam', 'Vietnamobile'),
  ('452', '005', '56', 'Vietnam', 'Vietnamobile'),
  ('452', '005', '58', 'Vietnam', 'Vietnamobile')
ON CONFLICT (mcc, mnc, prefix) DO NOTHING;

-- Morocco (MCC 604)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('604', '001', '66', 'Morocco', 'Maroc Telecom (IAM)'),
  ('604', '001', '67', 'Morocco', 'Maroc Telecom (IAM)'),
  ('604', '001', '61', 'Morocco', 'Maroc Telecom (IAM)'),
  ('604', '000', '68', 'Morocco', 'Orange'),
  ('604', '000', '64', 'Morocco', 'Orange'),
  ('604', '002', '62', 'Morocco', 'inwi'),
  ('604', '002', '65', 'Morocco', 'inwi'),
  ('604', '002', '70', 'Morocco', 'inwi')
ON CONFLICT (mcc, mnc, prefix) DO NOTHING;

-- Sri Lanka (MCC 413)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('413', '002', '71', 'Sri Lanka', 'Dialog'),
  ('413', '002', '76', 'Sri Lanka', 'Dialog'),
  ('413', '002', '77', 'Sri Lanka', 'Dialog'),
  ('413', '001', '70', 'Sri Lanka', 'Mobitel'),
  ('413', '001', '72', 'Sri Lanka', 'Mobitel'),
  ('413', '005', '75', 'Sri Lanka', 'Airtel'),
  ('413', '005', '78', 'Sri Lanka', 'Airtel'),
  ('413', '008', '72', 'Sri Lanka', 'Hutch')
ON CONFLICT (mcc, mnc, prefix) DO NOTHING;

-- Nepal (MCC 429)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('429', '001', '984', 'Nepal', 'Nepal Telecom (Namaste)'),
  ('429', '001', '985', 'Nepal', 'Nepal Telecom (Namaste)'),
  ('429', '001', '986', 'Nepal', 'Nepal Telecom (Namaste)'),
  ('429', '001', '974', 'Nepal', 'Nepal Telecom (Namaste)'),
  ('429', '001', '975', 'Nepal', 'Nepal Telecom (Namaste)'),
  ('429', '002', '980', 'Nepal', 'Ncell'),
  ('429', '002', '981', 'Nepal', 'Ncell'),
  ('429', '002', '982', 'Nepal', 'Ncell'),
  ('429', '004', '961', 'Nepal', 'Smart Cell'),
  ('429', '004', '962', 'Nepal', 'Smart Cell'),
  ('429', '004', '988', 'Nepal', 'Smart Cell')
ON CONFLICT (mcc, mnc, prefix) DO NOTHING;
