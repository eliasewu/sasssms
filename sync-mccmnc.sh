#!/bin/bash
# ── MCC/MNC CSV Auto-Sync ───────────────────────────────────────────────────
# Checks /opt/net2app/MCCMNC.csv for updates since last import.
# If the file is newer, runs the Node.js import script and updates the timestamp
# marker. Designed to be called from cron (e.g., weekly).
#
# Logs to: /var/log/net2app-mccmnc-sync.log
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

APP_DIR="/opt/net2app"
CSV_FILE="$APP_DIR/MCCMNC.csv"
MARKER_FILE="$APP_DIR/.mccmnc-last-import"
LOG_FILE="/var/log/net2app-mccmnc-sync.log"
SCRIPT="$APP_DIR/scripts/sync-mccmnc.ts"
LOCK_FILE="/tmp/net2app-mccmnc-sync.lock"

# Prevent overlapping runs (same pattern as health-check.sh)
exec 200>"$LOCK_FILE"
/usr/bin/flock -n 200 || exit 0

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# ── Check prerequisites ──
if [ ! -f "$CSV_FILE" ]; then
  log "ERROR: CSV file not found at $CSV_FILE — skipping sync"
  exit 1
fi

if [ ! -f "$SCRIPT" ]; then
  log "ERROR: Import script not found at $SCRIPT — skipping sync"
  exit 1
fi

# ── Resolve tsx path (cron has minimal PATH) ──
TSX_BIN=""
if [ -x "$APP_DIR/node_modules/.bin/tsx" ]; then
  TSX_BIN="$APP_DIR/node_modules/.bin/tsx"
elif command -v npx &>/dev/null; then
  TSX_BIN="npx tsx"
else
  log "ERROR: tsx not found — cannot run import script"
  exit 1
fi

# ── Compare file modification time against marker ──
CSV_MTIME=$(stat -c %Y "$CSV_FILE" 2>/dev/null || stat -f %m "$CSV_FILE" 2>/dev/null)

if [ -f "$MARKER_FILE" ]; then
  LAST_MTIME=$(cat "$MARKER_FILE")
  if [ "$CSV_MTIME" -le "$LAST_MTIME" ]; then
    # File hasn't changed — nothing to do
    exit 0
  fi
  log "CSV file changed (mtime: $LAST_MTIME → $CSV_MTIME) — starting import..."
else
  log "No previous import marker — performing initial import..."
fi

# ── Run the import ──
cd "$APP_DIR"

# Pipe stdout (summary line) into the log; stderr already goes to log via cron redirect
if $TSX_BIN "$SCRIPT" "$CSV_FILE" 2>&1 | tee -a "$LOG_FILE"; then
  # Record the file's current mtime as the marker
  echo "$CSV_MTIME" > "$MARKER_FILE"
  log "Import successful — marker updated"
else
  log "ERROR: Import script failed (exit code: ${PIPESTATUS[0]:-$?})"
  exit 1
fi
