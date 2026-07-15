-- ============================================================
-- 0006: Support Ticket Attachments
-- Adds file attachment support to ticket replies.
-- Files are stored on disk under public/uploads/tickets/
-- ============================================================

CREATE TABLE IF NOT EXISTS support_ticket_attachments (
  id SERIAL PRIMARY KEY,
  reply_id INTEGER NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_attachments_reply ON support_ticket_attachments(reply_id);
