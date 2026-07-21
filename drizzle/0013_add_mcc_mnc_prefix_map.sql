-- Migration: Add mcc_mnc_prefix_map table
-- Maps phone number prefixes → MNC per country, because MNC codes
-- (like "02") don't directly correspond to phone number prefixes (like "018").
-- The prefix is stored WITHOUT the trunk "0" since it matches against the
-- local number after country code stripping.

CREATE TABLE IF NOT EXISTS mcc_mnc_prefix_map (
  id SERIAL PRIMARY KEY,
  mcc VARCHAR(10) NOT NULL,
  mnc VARCHAR(10) NOT NULL,
  prefix VARCHAR(20) NOT NULL,
  country_name VARCHAR(100),
  network_name VARCHAR(255)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mcc_mnc_prefix_map_unique ON mcc_mnc_prefix_map (mcc, mnc, prefix);
CREATE INDEX IF NOT EXISTS idx_mcc_mnc_prefix_map_lookup ON mcc_mnc_prefix_map (mcc, prefix);

-- Seed data: Bangladesh (MCC 470)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('470', '01', '17', 'Bangladesh', 'Grameenphone'),
  ('470', '01', '13', 'Bangladesh', 'Grameenphone'),
  ('470', '02', '18', 'Bangladesh', 'Robi'),
  ('470', '03', '19', 'Bangladesh', 'Banglalink'),
  ('470', '03', '14', 'Bangladesh', 'Banglalink'),
  ('470', '05', '15', 'Bangladesh', 'Teletalk'),
  ('470', '06', '16', 'Bangladesh', 'Airtel');

-- Seed data: India (MCC 404, 405)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('404', '10', '98', 'India', 'Airtel'),
  ('404', '10', '99', 'India', 'Airtel'),
  ('404', '20', '97', 'India', 'Vodafone Idea'),
  ('404', '30', '96', 'India', 'Vodafone Idea'),
  ('404', '40', '94', 'India', 'BSNL'),
  ('404', '40', '77', 'India', 'BSNL'),
  ('404', '45', '70', 'India', 'Airtel'),
  ('404', '45', '90', 'India', 'Airtel'),
  ('404', '60', '93', 'India', 'Reliance Jio'),
  ('404', '60', '62', 'India', 'Reliance Jio'),
  ('404', '60', '91', 'India', 'Reliance Jio'),
  ('404', '60', '88', 'India', 'Reliance Jio'),
  ('404', '60', '86', 'India', 'Reliance Jio'),
  ('404', '60', '82', 'India', 'Reliance Jio'),
  ('404', '60', '80', 'India', 'Reliance Jio'),
  ('404', '60', '76', 'India', 'Reliance Jio');

-- Seed data: Pakistan (MCC 410)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('410', '01', '30', 'Pakistan', 'Mobilink/Jazz'),
  ('410', '01', '31', 'Pakistan', 'Mobilink/Jazz'),
  ('410', '01', '32', 'Pakistan', 'Mobilink/Jazz'),
  ('410', '03', '33', 'Pakistan', 'Ufone'),
  ('410', '04', '34', 'Pakistan', 'Zong'),
  ('410', '06', '30', 'Pakistan', 'Telenor'),
  ('410', '06', '34', 'Pakistan', 'Telenor');

-- Seed data: Turkey (MCC 286)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('286', '01', '53', 'Turkey', 'Turkcell'),
  ('286', '01', '54', 'Turkey', 'Turkcell'),
  ('286', '02', '50', 'Turkey', 'Vodafone'),
  ('286', '02', '55', 'Turkey', 'Vodafone'),
  ('286', '03', '55', 'Turkey', 'Avea/Turk Telekom'),
  ('286', '03', '50', 'Turkey', 'Avea/Turk Telekom');

-- Seed data: UK (MCC 234, 235)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('234', '10', '77', 'UK', 'O2'),
  ('234', '10', '78', 'UK', 'O2'),
  ('234', '15', '73', 'UK', 'Vodafone'),
  ('234', '15', '74', 'UK', 'Vodafone'),
  ('234', '30', '79', 'UK', 'EE'),
  ('234', '30', '78', 'UK', 'EE'),
  ('234', '20', '75', 'UK', 'Three');

-- Seed data: Nigeria (MCC 621)
INSERT INTO mcc_mnc_prefix_map (mcc, mnc, prefix, country_name, network_name) VALUES
  ('621', '20', '80', 'Nigeria', 'Airtel'),
  ('621', '20', '81', 'Nigeria', 'Airtel'),
  ('621', '30', '70', 'Nigeria', 'MTN'),
  ('621', '30', '80', 'Nigeria', 'MTN'),
  ('621', '40', '80', 'Nigeria', 'Globacom'),
  ('621', '40', '81', 'Nigeria', 'Globacom'),
  ('621', '50', '90', 'Nigeria', '9mobile/Etisalat');
