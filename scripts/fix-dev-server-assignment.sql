-- =============================================================
-- Fix: 15.235.35.125 (Canada Toronto) is a DEVELOPMENT box.
-- It must never be assigned to tenants.
--
-- 1) Mark the "canada" location as role=development + isActive=false
--    in server_locations so registration auto-assignment skips it.
-- 2) Migrate existing tenants on the dev IP onto production servers:
--    - CA/US/MX country codes -> Origin (149.56.22.232)   [location canada-origin]
--    - AU/NZ/...              -> Sydney (139.99.148.65)   [location sydney]
--    - everything else        -> France (54.37.252.5)     [location france]
-- 3) Guard the global smppServerIp fallback (if it points at dev).
-- =============================================================

-- 1) server_locations: mark dev location non-assignable
UPDATE platform_settings
SET value = (
  SELECT json_agg(
    CASE
      WHEN (elem->>'ipAddress') = '15.235.35.125'
        THEN jsonb_set(jsonb_set(elem::jsonb, '{isActive}', 'false'::jsonb), '{role}', '"development"'::jsonb)::json
      ELSE elem
    END
  )
  FROM json_array_elements(value::json) AS elem
)
WHERE key = 'server_locations';

-- 2) Migrate tenants off the dev IP
UPDATE tenants
SET smpp_server_ip = CASE
      WHEN server_location IN ('canada','canada-origin') OR server_location = '' OR server_location IS NULL
        THEN '149.56.22.232'
      WHEN server_location = 'sydney' THEN '139.99.148.65'
      ELSE '54.37.252.5'
    END,
    server_location = CASE
      WHEN server_location IN ('canada','canada-origin') OR server_location = '' OR server_location IS NULL
        THEN 'canada-origin'
      WHEN server_location = 'sydney' THEN 'sydney'
      ELSE 'france'
    END,
    updated_at = NOW()
WHERE smpp_server_ip = '15.235.35.125';

-- 3) Global fallback must not be the dev IP
UPDATE platform_settings
SET value = '54.37.252.5'
WHERE key = 'smppServerIp' AND value = '15.235.35.125';
