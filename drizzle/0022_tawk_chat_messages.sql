-- Migration 0022: Tawk.to Chat Messages
-- Stores chat conversations from the Tawk.to widget for customer support tracking

CREATE TABLE IF NOT EXISTS tawk_chat_messages (
  id SERIAL PRIMARY KEY,
  property_id VARCHAR(50) NOT NULL,
  chat_id VARCHAR(100),
  sender_type VARCHAR(20) NOT NULL,
  sender_name VARCHAR(255),
  message TEXT NOT NULL,
  message_timestamp TIMESTAMP,
  visitor_name VARCHAR(255),
  visitor_email VARCHAR(255),
  is_read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tawk_chat_messages_chat_id ON tawk_chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_tawk_chat_messages_property_id ON tawk_chat_messages(property_id);
CREATE INDEX IF NOT EXISTS idx_tawk_chat_messages_created_at ON tawk_chat_messages(created_at);
