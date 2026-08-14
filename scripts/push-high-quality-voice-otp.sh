#!/usr/bin/env bash
# push-high-quality-voice-otp.sh — deploy the newly generated high-quality
# builtin Voice OTP audio (public/audio/builtin/, 56 languages) to all servers,
# point each server's voice_otp_default_audio table at the new files, restart
# the apps (so the public/ file index picks up the new audio), and seed the
# defaults into every tenant schema.
#
# Requires: sshpass.  Usage: bash scripts/push-high-quality-voice-otp.sh

set -uo pipefail
cd "$(dirname "$0")/.."

export SSHPASS='Telco1988'
SSH_OPTS="-o StrictHostKeyChecking=no"
UPDATE_SQL="scripts/update-voice-otp-defaults.sql"
SEED_SQL="scripts/seed-voice-otp-defaults-to-tenants.sql"

SERVERS=(
  "149.56.22.232:origin"
  "54.37.252.5:france"
  "145.239.1.7:germany"
  "139.99.148.65:sydney"
  "139.99.148.177:sydney2"
  "15.235.35.125:devbox"
)

ssh_cmd() { # $1=ip $2=command (runs as ubuntu; sudo used inside where needed)
  sshpass -e ssh $SSH_OPTS ubuntu@"$1" "$2"
}

sudo_pre() { # password for devbox's sudo, nothing for others
  echo 'Telco1988'
}

# ── 1. rsync the builtin audio to /opt/net2app on every server ──
for entry in "${SERVERS[@]}"; do
  ip="${entry%%:*}"; name="${entry##*:}"
  echo "── [$name] sync builtin audio ──"
  if [ "$name" = "devbox" ]; then
    ssh_cmd "$ip" "echo 'Telco1988' | sudo -S -p '' mkdir -p /opt/net2app/public/audio && echo 'Telco1988' | sudo -S -p '' chown -R ubuntu:ubuntu /opt/net2app/public/audio 2>/dev/null"
  else
    ssh_cmd "$ip" "sudo mkdir -p /opt/net2app/public/audio && sudo chown -R ubuntu:ubuntu /opt/net2app/public/audio"
  fi
  sshpass -e rsync -az --delete -e "ssh $SSH_OPTS" \
    public/audio/builtin/ "ubuntu@$ip:/opt/net2app/public/audio/builtin/" 2>&1 | tail -1
  echo "  synced: $(ssh_cmd "$ip" "ls /opt/net2app/public/audio/builtin/ 2>/dev/null | wc -l") language dirs"
done

# ── 2. Update voice_otp_default_audio on every server's DB ──
for entry in "${SERVERS[@]}"; do
  ip="${entry%%:*}"; name="${entry##*:}"
  echo "── [$name] update defaults table ──"
  sshpass -e scp $SSH_OPTS "$UPDATE_SQL" "ubuntu@$ip:/tmp/update-voice-otp-defaults.sql" 2>/dev/null
  if [ "$name" = "devbox" ]; then
    ssh_cmd "$ip" "echo 'Telco1988' | sudo -S -p '' -u postgres psql -d app_db -f /tmp/update-voice-otp-defaults.sql 2>&1 | tail -2"
  else
    ssh_cmd "$ip" "sudo -u postgres psql -d app_db -f /tmp/update-voice-otp-defaults.sql 2>&1 | tail -2"
  fi
done

# ── 3. Restart the app on every server (index new public/ audio files) ──
for entry in "${SERVERS[@]}"; do
  ip="${entry%%:*}"; name="${entry##*:}"
  echo "── [$name] restart app ──"
  case "$name" in
    origin|sydney2|devbox) PM2CMD="echo 'Telco1988' | sudo -S -p '' PM2_HOME=/root/.pm2 pm2 restart net2app" ;;
    *) PM2CMD="PM2_HOME=/home/ubuntu/.pm2 pm2 restart net2app" ;;
  esac
  ssh_cmd "$ip" "$PM2CMD" 2>&1 | grep -E "restart|online|error" | head -2
done

# ── 4. Seed defaults into every tenant schema ──
for entry in "${SERVERS[@]}"; do
  ip="${entry%%:*}"; name="${entry##*:}"
  echo "── [$name] seed defaults → tenants ──"
  sshpass -e scp $SSH_OPTS "$SEED_SQL" "ubuntu@$ip:/tmp/seed-voice-otp-defaults-to-tenants.sql" 2>/dev/null
  if [ "$name" = "devbox" ]; then
    ssh_cmd "$ip" "echo 'Telco1988' | sudo -S -p '' -u postgres psql -d app_db -f /tmp/seed-voice-otp-defaults-to-tenants.sql 2>&1 | tail -2"
  else
    ssh_cmd "$ip" "sudo -u postgres psql -d app_db -f /tmp/seed-voice-otp-defaults-to-tenants.sql 2>&1 | tail -2"
  fi
done

echo ""
echo "✅ Done — builtin audio synced, defaults updated, apps restarted, tenants seeded on all servers."
