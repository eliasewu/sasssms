-- Fix system_type defaults for Ejoin SMPP server compatibility
-- Ejoin SMSC expects system_type = 'ESME' for client connections
-- This migration updates all existing tables and records

-- Update all existing suppliers that have NULL or empty system_type
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT schema_name FROM tenants WHERE is_active = true
  LOOP
    BEGIN
      EXECUTE format('SET search_path TO %I', t.schema_name);
      -- Update suppliers table
      EXECUTE 'UPDATE suppliers SET system_type = ''ESME'' WHERE system_type IS NULL OR system_type = ''''';
      -- Also add default for future rows (if not already present)
      EXECUTE 'ALTER TABLE suppliers ALTER COLUMN system_type SET DEFAULT ''ESME''';
      -- Update clients table too
      EXECUTE 'UPDATE clients SET smpp_system_type = ''ESME'' WHERE smpp_system_type IS NULL OR smpp_system_type = ''''';
      EXECUTE 'ALTER TABLE clients ALTER COLUMN smpp_system_type SET DEFAULT ''ESME''';
    EXCEPTION WHEN OTHERS THEN
      -- Table may not exist in this tenant
    END;
  END LOOP;
  SET search_path TO public;
END $$;
