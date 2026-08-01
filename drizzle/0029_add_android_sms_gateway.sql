-- Migration 0029: Android SMS Gateway
-- Enables Android phones to act as SMS gateways (suppliers in SERVER mode)
-- Tenants download the app, enter supplier credentials, and the phone auto-connects
-- to all Net2APP servers via SMPP, routing SMS through the phone's native radio.

-- 1. Add android_gateway_devices table (public schema — cross-server visibility)
CREATE TABLE IF NOT EXISTS android_gateway_devices (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  schema_name VARCHAR(100) NOT NULL,
  supplier_id INTEGER NOT NULL,
  device_name VARCHAR(255),
  phone_number VARCHAR(50),
  device_id VARCHAR(255) UNIQUE NOT NULL,
  smpp_username VARCHAR(100) NOT NULL,
  server_ip VARCHAR(50),
  bind_status VARCHAR(20) DEFAULT 'UNBOUND',
  last_seen TIMESTAMP,
  sms_sent_count INTEGER DEFAULT 0,
  sms_received_count INTEGER DEFAULT 0,
  app_version VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agw_tenant ON android_gateway_devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agw_supplier ON android_gateway_devices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_agw_device_id ON android_gateway_devices(device_id);

-- 2. Add connection_type constraint update comment (informational only)
-- suppliers.connection_type now accepts: 'SMPP', 'HTTP_API', 'VOICE_OTP', 'WhatsApp OTT', 
-- 'Telegram OTT', 'CUSTOM_API', 'ANDROID_SMS'
-- No ALTER needed — connection_type is already varchar(50) without enum constraint.
