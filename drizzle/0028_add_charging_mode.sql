-- Migration: Add charging_mode and dlr_timeout to clients and suppliers
-- Also migrates existing billing_mode + force_dlr values to the new charging_mode

-- Clients: add charging_mode and dlr_timeout columns
ALTER TABLE clients ADD COLUMN IF NOT EXISTS charging_mode VARCHAR(50) DEFAULT 'on_submit';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS dlr_timeout INTEGER;

-- Suppliers: add charging_mode and dlr_timeout columns
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS charging_mode VARCHAR(50) DEFAULT 'on_submit';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS dlr_timeout INTEGER;

-- Migrate existing client data:
-- billing_mode='dlr' → charging_mode='on_dlr'
-- force_dlr=true     → charging_mode='force_dlr'
-- else               → keep 'on_submit' (default)
UPDATE clients SET charging_mode = 'on_dlr' WHERE billing_mode = 'dlr' AND force_dlr = false;
UPDATE clients SET charging_mode = 'force_dlr' WHERE force_dlr = true;

-- Migrate existing supplier data:
-- force_dlr=true → charging_mode='force_dlr'
UPDATE suppliers SET charging_mode = 'force_dlr' WHERE force_dlr = true;
