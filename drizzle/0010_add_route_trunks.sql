-- Migration 0010: Add route_trunks junction table to all existing tenants
-- Allows one route to have multiple trunks (with priority ordering)

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT schema_name FROM tenants WHERE is_active = true
  LOOP
    BEGIN
      EXECUTE format('CREATE TABLE IF NOT EXISTS %I.route_trunks (
        id SERIAL PRIMARY KEY,
        route_id INTEGER NOT NULL,
        trunk_id INTEGER NOT NULL,
        priority INTEGER DEFAULT 1,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )', t.schema_name);
      RAISE NOTICE '%: route_trunks table created', t.schema_name;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '%: SKIPPED — %', t.schema_name, SQLERRM;
    END;
  END LOOP;
END $$;
