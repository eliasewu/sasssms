-- Add per-connector DLR polling configuration
ALTER TABLE custom_api_connectors ADD COLUMN IF NOT EXISTS dlr_poll_seconds INTEGER DEFAULT 30;
ALTER TABLE custom_api_connectors ADD COLUMN IF NOT EXISTS dlr_timeout_seconds INTEGER DEFAULT 3600;

-- Add last DLR poll timestamp to messages for per-message polling cadence tracking
ALTER TABLE messages ADD COLUMN IF NOT EXISTS last_dlr_poll_at TIMESTAMP;
