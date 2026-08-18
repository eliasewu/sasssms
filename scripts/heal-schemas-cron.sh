#!/bin/bash
# Net2APP nightly schema heal — reconciles every LOCALLY-hosted tenant schema
# against TENANT_TABLE_DEFS (adds missing tables/columns automatically).
#
# Installed as a nightly cron job:
#   0 3 * * * /home/ubuntu/saas-sms-platform-architecture/scripts/heal-schemas-cron.sh
#
# Safe to run any time: it is idempotent (only adds what's missing) and
# only touches schemas that physically exist on this server.
set -u
APP_DIR="/home/ubuntu/saas-sms-platform-architecture"
cd "$APP_DIR" || { echo "[$(date)] ERROR: $APP_DIR missing" >> "$APP_DIR/logs/heal-schemas.log" 2>/dev/null || true; exit 1; }

mkdir -p "$APP_DIR/logs"
LOG="$APP_DIR/logs/heal-schemas.log"
LOCK="/tmp/net2app-heal.lock"

# Prevent overlapping runs (a slow heal + cron re-trigger)
if [ -f "$LOCK" ]; then
  echo "[$(date)] SKIP: previous heal still running" >> "$LOG"
  exit 0
fi
touch "$LOCK"
trap 'rm -f "$LOCK"' EXIT

export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"')"
if [ -z "$DATABASE_URL" ]; then
  echo "[$(date)] ERROR: no DATABASE_URL in $APP_DIR/.env" >> "$LOG"
  exit 1
fi

# Rotate log if it grows past 5MB (approx 2 years of nightly runs)
if [ -f "$LOG" ]; then
  SIZE=$(stat -c%s "$LOG" 2>/dev/null || echo 0)
  if [ "$SIZE" -gt 5242880 ]; then
    mv "$LOG" "$LOG.old" 2>/dev/null || true
  fi
fi

echo "=== [$(date)] nightly schema heal start ===" >> "$LOG"
node_modules/.bin/tsx scripts/heal-all-tenant-schemas.ts >> "$LOG" 2>&1
echo "exit=$? [$(date)]" >> "$LOG"
