-- Migration 0023: Self-hosted Live Chat
-- Real-time support chat between tenants and super admins

CREATE TABLE IF NOT EXISTS live_chat_rooms (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  tenant_name VARCHAR(255) NOT NULL,
  tenant_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) DEFAULT 'Support Chat',
  status VARCHAR(20) DEFAULT 'OPEN' NOT NULL,
  last_message_at TIMESTAMP DEFAULT NOW() NOT NULL,
  unread_tenant INTEGER DEFAULT 0,
  unread_super INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS live_chat_messages (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES live_chat_rooms(id),
  sender_type VARCHAR(20) NOT NULL,
  sender_id INTEGER,
  sender_name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_live_chat_messages_room_id ON live_chat_messages(room_id, created_at);
CREATE INDEX IF NOT EXISTS idx_live_chat_rooms_tenant_id ON live_chat_rooms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_live_chat_rooms_status ON live_chat_rooms(status);
