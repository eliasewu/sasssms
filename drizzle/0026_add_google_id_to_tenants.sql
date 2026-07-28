ALTER TABLE tenants ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_google_id ON tenants(google_id) WHERE google_id IS NOT NULL;
