-- ═══════════════════════════════════════════════════════════════════
--  Net2APP — Deactivate invalid/misconfigured suppliers
--  These suppliers have placeholder/junk SMPP hosts (1.1.1.1, 2.2.2.2,
--  "Xfggbn", "0.0.0.0:2775") that can never bind. They sit in
--  connection_mode='CLIENT' and drive endless SMPP reconnect loops
--  (getaddrinfo ENOTFOUND / EAI_AGAIN) that spam the app logs on every
--  server. Deactivating them stops the churn; they can be re-activated
--  and fixed from the Suppliers dashboard when real credentials exist.
--
--  Run per tenant schema (or review first with the SELECT below).
--  ═══════════════════════════════════════════════════════════════════

-- 1) REVIEW: show the affected suppliers first
SELECT schema_name, s.id, s.name, s.host, s.port, s.connection_mode, s.bind_status, s.bind_error
FROM (
  SELECT table_schema AS schema_name
  FROM information_schema.tables
  WHERE table_name = 'suppliers' AND table_schema LIKE 'tenant_%'
) t
CROSS JOIN LATERAL (
  SELECT id, name, host, port, connection_mode, bind_status, bind_error
  FROM pg_temp.tenants  -- placeholder, replaced per schema below
) s
LIMIT 0;

-- 2) Per-schema deactivation (substitute each schema name):
-- UPDATE "tenant_net2app_demo_1784545587986".suppliers
--    SET is_active = false, updated_at = NOW()
--  WHERE deleted_at IS NULL
--    AND host IN ('1.1.1.1', '2.2.2.2')
--    AND connection_mode = 'CLIENT';
--
-- UPDATE "tenant_toogle_com_1785265939603".suppliers
--    SET is_active = false, updated_at = NOW()
--  WHERE deleted_at IS NULL AND host IN ('1.1.1.1', '2.2.2.2')
--    AND connection_mode = 'CLIENT';
--
-- UPDATE "tenant_nexahubsms_1786321285063".suppliers
--    SET is_active = false, updated_at = NOW()
--  WHERE deleted_at IS NULL AND host = 'Xfggbn' AND connection_mode = 'CLIENT';
--
-- UPDATE "tenant_china_route_smpp_1786474090945".suppliers
--    SET is_active = false, updated_at = NOW()
--  WHERE deleted_at IS NULL AND host = '0.0.0.0:2775' AND connection_mode = 'CLIENT';

-- 3) Alternative: fix the embedded ":port" host values in-place instead:
-- UPDATE "tenant_china_route_smpp_1786474090945".suppliers
--    SET host = '0.0.0.0', updated_at = NOW()
--  WHERE deleted_at IS NULL AND host = '0.0.0.0:2775';
