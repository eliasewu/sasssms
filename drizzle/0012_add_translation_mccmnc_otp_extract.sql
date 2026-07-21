-- 0012_add_translation_mccmnc_otp_extract.sql
-- Adds MCC/MNC support to translation_profiles and creates OTP extract rules

-- Add category and MCC/MNC columns to translation_profiles
ALTER TABLE translation_profiles 
  ADD COLUMN IF NOT EXISTS category VARCHAR(30) DEFAULT 'SID',
  ADD COLUMN IF NOT EXISTS mcc VARCHAR(10),
  ADD COLUMN IF NOT EXISTS mnc VARCHAR(10),
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Create OTP extract rules table
CREATE TABLE IF NOT EXISTS otp_extract_rules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  mcc VARCHAR(10),
  mnc VARCHAR(10),
  regex_pattern TEXT NOT NULL,
  otp_group_index INTEGER DEFAULT 1,
  forward_supplier_id INTEGER,
  forward_sender VARCHAR(20),
  forward_template TEXT DEFAULT '{otp}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create OTP forward logs table for audit trail
CREATE TABLE IF NOT EXISTS otp_forward_logs (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER,
  inbox_message_id INTEGER,
  original_sender VARCHAR(20),
  original_content TEXT,
  extracted_otp VARCHAR(20),
  destination VARCHAR(20),
  forward_status VARCHAR(30),
  forward_message_id VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
