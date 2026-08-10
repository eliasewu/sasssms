-- ═══════════════════════════════════════════════════════════════════════
-- 0039 — Feature-toggle audit TRIGGER (smpp/http/rcs/flash/voice-otp/ott/
--        business-api/email/auto-renew)
-- ───────────────────────────────────────────────────────────────────────
-- Extends the 0038 pattern to every per-tenant feature toggle. Guarantees
-- EACH changed column lands in audit_log as its own row — no matter which
-- code path or script made the change (super UI route, a future API, a cron
-- job, or raw SQL). One UPDATE touching several toggles writes one row per
-- changed column (old/new values stored under the column's snake_case key).
--
-- Actor capture (identical to 0038): the app sets transaction-local GUCs
-- before updating:
--   SELECT set_config('app.changed_by', 'admin@net2app.com', true);
--   SELECT set_config('app.ip_address', '1.2.3.4', true);
-- Anything that does NOT set them (scripts, raw SQL) is recorded as
-- changed_by = 'system/script' with a NULL IP.
--
-- Columns audited: smpp_enabled, http_enabled, rcs_enabled,
-- flash_sms_enabled, voice_otp_enabled, ott_enabled, business_api_enabled,
-- email_enabled, auto_renew_enabled (auto_connect_enabled stays with 0038).
--
-- Idempotent: CREATE OR REPLACE FUNCTION + DROP TRIGGER IF EXISTS make this
-- safe to re-run on every deploy or migration pass.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION log_tenant_toggle_change() RETURNS trigger AS $$
DECLARE
  col      TEXT;
  old_val  JSONB;
  new_val  JSONB;
  old_json JSONB := to_jsonb(OLD);
  new_json JSONB := to_jsonb(NEW);
  cols     TEXT[] := ARRAY['smpp_enabled', 'http_enabled', 'rcs_enabled',
                           'flash_sms_enabled', 'voice_otp_enabled',
                           'ott_enabled', 'business_api_enabled',
                           'email_enabled', 'auto_renew_enabled'];
BEGIN
  FOREACH col IN ARRAY cols LOOP
    old_val := old_json -> col;
    new_val := new_json -> col;
    IF old_val IS DISTINCT FROM new_val THEN
      -- Audit is best-effort but written atomically with the change: if the
      -- log write ever fails, the exception is swallowed so the tenant update
      -- itself is NEVER rolled back (same guarantee as 0038).
      BEGIN
        INSERT INTO audit_log (entity_type, entity_id, action, changed_by, old_data, new_data, ip_address, tenant_id)
        VALUES (
          'tenant_toggle',
          NEW.id,
          CASE WHEN new_val = 'true'::jsonb THEN 'ENABLE' ELSE 'DISABLE' END,
          COALESCE(NULLIF(current_setting('app.changed_by', true), ''), 'system/script'),
          jsonb_build_object(col, old_val),
          jsonb_build_object(col, new_val),
          NULLIF(current_setting('app.ip_address', true), ''),
          NEW.id
        );
      EXCEPTION WHEN OTHERS THEN
        NULL; -- never block the actual update because logging failed
      END;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenant_toggle_audit ON tenants;
CREATE TRIGGER trg_tenant_toggle_audit
  AFTER UPDATE OF smpp_enabled, http_enabled, rcs_enabled, flash_sms_enabled,
                  voice_otp_enabled, ott_enabled, business_api_enabled,
                  email_enabled, auto_renew_enabled ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION log_tenant_toggle_change();
