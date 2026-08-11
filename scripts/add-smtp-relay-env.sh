#!/bin/bash
# Appends SMTP relay config to /opt/net2app/.env (idempotent)
set -e
ENV_FILE=/opt/net2app/.env
if [ ! -f "$ENV_FILE" ]; then
  echo "No .env at $ENV_FILE — nothing to do"
  exit 0
fi

add_var() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    # Update in place (escape & in value for sed replacement)
    local esc
    esc=$(printf '%s' "$val" | sed 's/[&/\]/\\&/g')
    sudo sed -i "s|^${key}=.*|${key}=${esc}|" "$ENV_FILE"
  else
    echo "${key}=${val}" | sudo tee -a "$ENV_FILE" > /dev/null
  fi
}

add_var "SMTP_HOST" "15.235.35.125"
add_var "SMTP_PORT" "25"
add_var "SMTP_USER" "monitor@net2app.com"
add_var "SMTP_PASS" "M0nitor@N2App2026!"
add_var "SUPER_ADMIN_EMAIL" "elias.ewu@gmail.com"

echo "=== resulting SMTP block in $ENV_FILE ==="
sudo grep -E "^(SMTP_|SUPER_ADMIN_EMAIL)" "$ENV_FILE" | sed 's/\(SMTP_PASS=\).*/\1***/'
