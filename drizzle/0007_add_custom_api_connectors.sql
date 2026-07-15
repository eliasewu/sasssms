CREATE TABLE IF NOT EXISTS custom_api_connectors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'HTTP_API',
  send_url_template TEXT NOT NULL,
  send_method VARCHAR(10) NOT NULL DEFAULT 'GET',
  send_headers TEXT,
  send_body_template TEXT,
  send_success_condition TEXT,
  send_message_id_path TEXT,
  dlr_url_template TEXT,
  dlr_method VARCHAR(10) DEFAULT 'GET',
  dlr_success_condition TEXT,
  dlr_status_path TEXT,
  dlr_delivered_value VARCHAR(100) DEFAULT 'Delivered',
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);
