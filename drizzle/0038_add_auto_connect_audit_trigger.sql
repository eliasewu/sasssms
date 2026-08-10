-- ═══════════════════════════════════════════════════════════════════════
-- 0038 — Auto-Connect approval audit TRIGGER
-- ───────────────────────────────────────────────────────────────────────
-- Guarantees EVERY change to tenants.auto_connect_enabled lands in
-- audit_log — no matter which code path or script made it (super UI route,
-- a future API, a cron job, or raw SQL).
--
-- Actor capture: the app sets transaction-local GUCs before updating:
--   SELECT set_config('app.changed_by', 'admin@net2app.com', true);
--   SELECT set_config('app.ip_address', '1.2.3.4', true);
-- Anything that does NOT set them (scripts, raw SQL) is recorded as
-- changed_by = 'system/script' with a NULL IP — so the audit trail is
-- complete even for unattended writes.
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS make
-- this safe to re-run on every deploy or migration pass.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION log_auto_connect_change() RETURNS trigger AS $$
BEGIN
  IF OLD.auto_connect_enabled IS DISTINCT FROM NEW.auto_connect_enabled THEN
    -- Audit is best-effort but written atomically with the change: if the log
    -- write ever fails (e.g. audit_log missing on a partially-migrated DB), the
    -- exception is swallowed so the tenant update itself is NEVER rolled back.
    BEGIN
      INSERT INTO audit_log (entity_type, entity_id, action, changed_by, old_data, new_data, ip_address, tenant_id)
      VALUES (
        'tenant_auto_connect',
        NEW.id,
        CASE WHEN NEW.auto_connect_enabled THEN 'ENABLE' ELSE 'DISABLE' END,
        COALESCE(NULLIF(current_setting('app.changed_by', true), ''), 'system/script'),
        jsonb_build_object('autoConnectEnabled', OLD.auto_connect_enabled),
        jsonb_build_object('autoConnectEnabled', NEW.auto_connect_enabled),
        NULLIF(current_setting('app.ip_address', true), ''),
        NEW.id
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- never block the actual update because logging failed
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_connect_audit ON tenants;
CREATE TRIGGER trg_auto_connect_audit
  AFTER UPDATE OF auto_connect_enabled ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION log_auto_connect_change();
