-- ============================================================
-- 0005: Support Ticket System
-- Creates cross-tenant support_tickets and support_ticket_replies
-- tables in the public schema. Applied to all existing tenants
-- automatically via the DO block below.
-- ============================================================

-- Create tables in public schema (idempotent)
CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  schema_name VARCHAR(100) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'OPEN' NOT NULL,
  priority VARCHAR(20) DEFAULT 'MEDIUM' NOT NULL,
  replied_by VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS support_ticket_replies (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL,
  replied_by VARCHAR(20) NOT NULL,
  replied_by_id INTEGER,
  replied_by_name VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant ON support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_ticket_replies_ticket ON support_ticket_replies(ticket_id);
