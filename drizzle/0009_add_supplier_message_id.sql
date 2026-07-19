-- Migration: Add supplier_message_id column to messages tables across all tenants
-- This column stores the SMSC-assigned message ID for DLR matching

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT schema_name FROM tenants WHERE is_active = true
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %I.messages ADD COLUMN IF NOT EXISTS supplier_message_id VARCHAR(255)', t.schema_name);
      RAISE NOTICE 'Added supplier_message_id to %.messages', t.schema_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipped %.messages: %', t.schema_name, SQLERRM;
    END;
  END LOOP;
END
$$;
