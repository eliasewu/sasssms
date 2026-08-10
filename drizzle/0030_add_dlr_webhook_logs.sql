-- Migration 0030: DLR Webhook Delivery Log
-- Records every HTTP DLR push to an external client so operators can verify
-- webhooks were actually delivered (message_id, status, pushed_to URL,
-- HTTP status, response body, success, timestamp).

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT schema_name FROM tenants WHERE is_active = true
  LOOP
    BEGIN
      EXECUTE format('CREATE TABLE IF NOT EXISTS %I.dlr_webhook_logs (
        id SERIAL PRIMARY KEY,
        message_id VARCHAR(100),
        dlr_status VARCHAR(50),
        pushed_to TEXT,
        http_status INTEGER,
        response TEXT,
        success BOOLEAN DEFAULT false,
        error TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )', t.schema_name);
      RAISE NOTICE 'Created dlr_webhook_logs in %.', t.schema_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped %.dlr_webhook_logs: %', t.schema_name, SQLERRM;
    END;
  END LOOP;
END
$$;
