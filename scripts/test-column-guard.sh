#!/bin/bash
# Functional test for check_net2app_column_errors in health-check.sh
# Extracts ONLY the guard functions (not the whole script, which auto-runs all
# checks when sourced) and exercises them against a fake error log with mocked
# ss/pm2.
set -u

cd /home/ubuntu/saas-sms-platform-architecture || exit 1
bash -n health-check.sh || { echo "FAIL: syntax error in health-check.sh"; exit 1; }
echo "SYNTAX OK"

# ── Test harness ──
LOG_FILE=/tmp/test-column-guard.log
rm -f "$LOG_FILE" /tmp/mocked-pm2-actions.txt /tmp/net2app-column-restart
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }
APP_PORT=5556

# Extract resolve_pm2_err_log + check_net2app_column_errors from health-check.sh
awk '/^resolve_pm2_err_log\(\)/,/^# ── Check Net2APP \(PM2\) ──/' health-check.sh | head -n -1 > /tmp/extracted-guards.sh
echo "extracted $(grep -c '() {' /tmp/extracted-guards.sh) functions"
source /tmp/extracted-guards.sh

# Mocks
ss() { echo "LISTEN 0 511 127.0.0.1:5556"; }
pm2() {
  if [ "$1" = "restart" ]; then
    echo "mocked pm2 restart $2" >> /tmp/mocked-pm2-actions.txt
  fi
  return 0
}
export -f ss pm2

# Fake pm2 error log dir at the deterministic path the resolver prefers
FAKE_DIR=/tmp/fake-home
mkdir -p "$FAKE_DIR/.pm2/logs"
export HOME="$FAKE_DIR"
FAKE_ERR="$FAKE_DIR/.pm2/logs/net2app-error.log"

seed_err_log() { cat > "$FAKE_ERR"; }

echo "=== RUN 1: missing-column error, no cooldown -> restart + alert ==="
seed_err_log <<'EOF'
2026-08-11T10:00:01.123Z error: column "gsm_device_id" of relation "suppliers" does not exist
    at Parser.parseErrorMessage (/opt/net2app/node_modules/pg-protocol/dist/parser.js:287:98)
2026-08-11T10:00:02.000Z GET /api/tenant/send-sms 500
EOF
rm -f /tmp/mocked-pm2-actions.txt /tmp/net2app-column-restart
check_net2app_column_errors
echo "  restarts: $(grep -c restart /tmp/mocked-pm2-actions.txt 2>/dev/null || echo 0)"
grep -q '❌ Schema mismatch' "$LOG_FILE" && echo "  ALERT LOGGED ✓" || echo "  MISSING ALERT ✗"
[ -f /tmp/net2app-column-restart ] && echo "  COOLDOWN WRITTEN ✓" || echo "  NO COOLDOWN ✗"
grep -q 'gsm_device_id' "$LOG_FILE" && echo "  COLUMN NAME IN ALERT ✓" || echo "  COLUMN NAME MISSING ✗"

echo "=== RUN 2: within 120s cooldown -> skip restart ==="
rm -f /tmp/mocked-pm2-actions.txt
check_net2app_column_errors
echo "  restarts: $(grep -c restart /tmp/mocked-pm2-actions.txt 2>/dev/null || echo 0)"
grep -q 'within 120s cooldown' "$LOG_FILE" && echo "  COOLDOWN SKIP ✓" || echo "  NO SKIP ✗"

echo "=== RUN 3: clean log -> no-op ==="
seed_err_log <<'EOF'
2026-08-11T10:00:10.000Z GET /api/public/health 200
EOF
rm -f /tmp/net2app-column-restart /tmp/mocked-pm2-actions.txt
check_net2app_column_errors
echo "  restarts: $(grep -c restart /tmp/mocked-pm2-actions.txt 2>/dev/null || echo 0)"

echo "=== RUN 4: bare 'column x does not exist' (no 'of relation') -> matches ==="
seed_err_log <<'EOF'
error: column "updated_at" does not exist
EOF
rm -f /tmp/net2app-column-restart /tmp/mocked-pm2-actions.txt
check_net2app_column_errors
echo "  restarts: $(grep -c restart /tmp/mocked-pm2-actions.txt 2>/dev/null || echo 0)"
grep -q 'updated_at' "$LOG_FILE" && echo "  MATCHED BARE FORM ✓" || echo "  BARE FORM MISSED ✗"
echo "=== DONE ==="
