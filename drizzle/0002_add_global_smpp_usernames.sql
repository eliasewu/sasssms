-- Migration: Add global SMPP username index table (O(1) cross-tenant uniqueness)
-- Each tenant's clients.smpp_username is registered here so duplicate checks
-- are a single-row lookup instead of scanning all tenant schemas.

CREATE TABLE IF NOT EXISTS smpp_usernames (
    id SERIAL PRIMARY KEY,
    smpp_username VARCHAR(100) NOT NULL UNIQUE,
    tenant_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    schema_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Backfill: populate from existing tenant clients (one-time seed)
-- This must be run manually after the table is created.
-- It scans all active tenant schemas and registers existing SMPP usernames.
--
-- DO $$ 
-- DECLARE
--     t RECORD;
--     c RECORD;
-- BEGIN
--     FOR t IN SELECT id, schema_name FROM tenants WHERE is_active = true LOOP
--         EXECUTE format('SELECT id, smpp_username FROM %I.clients WHERE smpp_username IS NOT NULL AND deleted_at IS NULL', t.schema_name)
--         INTO c;
--         -- Insert into global index, skip conflicts (already indexed)
--         INSERT INTO smpp_usernames (smpp_username, tenant_id, client_id, schema_name)
--         SELECT c.smpp_username, t.id, c.id, t.schema_name
--         FROM %I.clients c
--         WHERE c.smpp_username IS NOT NULL AND c.deleted_at IS NULL
--         ON CONFLICT (smpp_username) DO NOTHING;
--     END LOOP;
-- END $$;
--
-- Or use a simpler approach via the application layer:
-- Run: npx ts-node -e "
--   const { pool } = require('./src/db');
--   (async () => {
--     const c = await pool.connect();
--     const { rows: tenants } = await c.query('SELECT id, schema_name FROM tenants WHERE is_active = true');
--     for (const t of tenants) {
--       await c.query('SET search_path TO ' + t.schema_name);
--       const { rows } = await c.query('SELECT id, smpp_username FROM clients WHERE smpp_username IS NOT NULL AND deleted_at IS NULL');
--       for (const r of rows) {
--         await c.query('INSERT INTO smpp_usernames (smpp_username, tenant_id, client_id, schema_name) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [r.smpp_username, t.id, r.id, t.schema_name]);
--       }
--     }
--     console.log('Backfill complete');
--   })();
-- "
