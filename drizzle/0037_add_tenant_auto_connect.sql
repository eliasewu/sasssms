-- Migration 0037: Per-tenant auto-connect installer approval
--
-- Only tenants with auto_connect_enabled = true get the Tailscale auth key
-- (and advertise tags) embedded in their 3proxy installers. Unapproved
-- tenants' installers fall back to the interactive login URL.
--
-- Default ON (true) — preserves existing behavior; super admins switch off
-- tenants they don't trust via Tenant Management → Edit → Auto-Connect Installer.
-- Run: psql $DATABASE_URL -f drizzle/0037_add_tenant_auto_connect.sql

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auto_connect_enabled boolean NOT NULL DEFAULT true;
