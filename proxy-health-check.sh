#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  Net2APP — Residential Proxy Health Check
#  Monitors the SOCKS5 proxy (3proxy + Tailscale) on net2app
#  Run via cron every 2 minutes: */2 * * * * /opt/net2app/proxy-health-check.sh
# ═══════════════════════════════════════════════════════════════════

LOG_FILE="/var/log/net2app-health.log"
MAX_LOG_SIZE_MB=10
LOCK_FILE="/tmp/net2app-proxy-health.lock"
STATE_FILE="/tmp/net2app-proxy-state"
ALERT_COOLDOWN=600  # 10 minutes between repeat alerts

# ── Source credentials from .env (falls back to defaults if missing) ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
elif [ -f "$SCRIPT_DIR/.env.local" ]; then
    export $(grep -v '^#' "$SCRIPT_DIR/.env.local" | xargs)
fi

# Proxy target (override via env: PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS)
PROXY_HOST="${PROXY_HOST:-100.127.45.126}"
PROXY_PORT="${PROXY_PORT:-1080}"
PROXY_USER="${PROXY_USER:-net2app}"
PROXY_PASS="${PROXY_PASS:-Str0ngPr0xy2025!}"
TEST_URL="https://ifconfig.me"
TIMEOUT=8

# DB connection (uses DATABASE_URL or defaults)
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"
DB_NAME="${DB_NAME:-app_db}"

# Prevent overlapping runs
exec 200>"$LOCK_FILE"
if ! /usr/bin/flock -n 200; then
    exit 0
fi

# Rotate log if too large
if [ -f "$LOG_FILE" ]; then
    LOG_SIZE=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
    if [ "$LOG_SIZE" -gt $((MAX_LOG_SIZE_MB * 1024 * 1024)) ]; then
        mv "$LOG_FILE" "${LOG_FILE}.old"
    fi
fi

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [PROXY] $1" >> "$LOG_FILE"
}

# Read last alert timestamp from state file
read_state() {
    if [ -f "$STATE_FILE" ]; then
        cat "$STATE_FILE"
    else
        echo "0"
    fi
}

write_state() {
    echo "$1" > "$STATE_FILE"
}

# Create a database alert (uses the alerts table in app_db)
create_db_alert() {
    local title="$1"
    local message="$2"
    local severity="${3:-error}"
    
    # Cooldown: don't spam alerts
    local last_alert
    last_alert=$(read_state)
    local now
    now=$(date +%s)
    if [ $((now - last_alert)) -lt $ALERT_COOLDOWN ]; then
        return 0
    fi
    
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
        INSERT INTO alerts (type, title, message, severity, is_read)
        SELECT 'proxy_down', '$title', '$message', '$severity', false
        WHERE NOT EXISTS (
            SELECT 1 FROM alerts
            WHERE type = 'proxy_down' AND is_read = false
              AND created_at > NOW() - INTERVAL '10 minutes'
        );
    " 2>/dev/null
    
    write_state "$now"
}

# Create a recovery alert when proxy comes back up
create_recovery_alert() {
    local title="$1"
    local message="$2"
    
    PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "
        INSERT INTO alerts (type, title, message, severity, is_read)
        SELECT 'proxy_recovery', '$title', '$message', 'info', false
        WHERE NOT EXISTS (
            SELECT 1 FROM alerts
            WHERE type = 'proxy_recovery' AND is_read = false
              AND created_at > NOW() - INTERVAL '30 minutes'
        );
    " 2>/dev/null
    
    # Reset cooldown so new DOWN alerts can fire
    write_state "0"
}

# ── Test 1: Tailscale connectivity ──
check_tailscale() {
    if ! command -v tailscale &>/dev/null; then
        log "❌ TAILSCALE: Not installed"
        return 1
    fi
    
    local ts_status
    ts_status=$(tailscale status 2>/dev/null | grep "$PROXY_HOST" | head -1)
    
    if [ -z "$ts_status" ]; then
        log "❌ TAILSCALE: net2app ($PROXY_HOST) NOT in mesh"
        return 1
    fi
    
    if echo "$ts_status" | grep -q "offline"; then
        log "⚠️  TAILSCALE: net2app is OFFLINE ($ts_status)"
        return 1
    fi
    
    local conn_type
    if echo "$ts_status" | grep -q "direct"; then
        conn_type="direct"
    elif echo "$ts_status" | grep -q "relay"; then
        conn_type="relay"
    else
        conn_type="unknown"
    fi
    
    log "✅ TAILSCALE: net2app active ($conn_type)"
    return 0
}

# ── Test 2: TCP port connectivity ──
check_tcp_port() {
    if timeout 3 bash -c "echo >/dev/tcp/$PROXY_HOST/$PROXY_PORT" 2>/dev/null; then
        log "✅ TCP: Port $PROXY_PORT OPEN"
        return 0
    else
        log "❌ TCP: Port $PROXY_PORT CLOSED"
        return 1
    fi
}

# ── Test 3: SOCKS5 proxy end-to-end ──
check_socks5_proxy() {
    local http_code
 local proxy_url
    
    if [ -n "$PROXY_USER" ] && [ -n "$PROXY_PASS" ]; then
        proxy_url="${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}"
    else
        proxy_url="${PROXY_HOST}:${PROXY_PORT}"
    fi
    
    http_code=$(curl --socks5-hostname "$proxy_url" \
        --max-time "$TIMEOUT" \
        -s -o /dev/null -w "%{http_code}" \
        "$TEST_URL" 2>/dev/null)
    
    if [ "$http_code" = "200" ]; then
        log "✅ SOCKS5: Proxy working (HTTP $http_code)"
        return 0
    elif [ "$http_code" = "000" ]; then
        log "❌ SOCKS5: Connection FAILED (timeout or refused)"
        return 2
    else
        log "⚠️  SOCKS5: Got HTTP $http_code (unexpected)"
        return 1
    fi
}

# ── Test 4: Proxy latency ──
check_latency() {
    local total_time
    total_time=$(curl --socks5-hostname "${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}" \
        --max-time "$TIMEOUT" \
        -s -o /dev/null -w "%{time_total}" \
        "$TEST_URL" 2>/dev/null)
    
    if [ -n "$total_time" ]; then
        local latency_ms
        latency_ms=$(echo "$total_time * 1000" | bc 2>/dev/null | cut -d. -f1)
        if [ -n "$latency_ms" ]; then
            log "⏱️  LATENCY: ${latency_ms}ms"
            if [ "$latency_ms" -gt 5000 ]; then
                log "⚠️  LATENCY: High (>5s) — possible network issue"
            fi
        fi
    fi
}

# ── Determine if this is a state transition ──
read_previous_state() {
    if [ -f "/tmp/net2app-proxy-last-status" ]; then
        cat "/tmp/net2app-proxy-last-status"
    else
        echo "unknown"
    fi
}

write_current_state() {
    echo "$1" > "/tmp/net2app-proxy-last-status"
}

# ── Main ──
main() {
    local failures=0
    local prev_state
    prev_state=$(read_previous_state)
    
    # Run all checks
    check_tailscale
    failures=$((failures + $?))
    
    check_tcp_port
    failures=$((failures + $?))
    
    check_socks5_proxy
    local proxy_result=$?
    if [ "$proxy_result" -ne 0 ]; then
        failures=$((failures + 1))
    fi
    
    # Determine current state
    local current_state
    if [ "$failures" -eq 0 ]; then
        current_state="healthy"
        check_latency
    elif [ "$failures" -le 1 ]; then
        current_state="degraded"
    else
        current_state="down"
    fi
    
    # Handle state transitions
    # Skip alerts on first run (prev_state = "unknown")
    if [ "$current_state" != "$prev_state" ] && [ "$prev_state" != "unknown" ]; then
        case "$current_state" in
            healthy)
                if [ "$prev_state" = "down" ] || [ "$prev_state" = "degraded" ]; then
                    log "🟢 RECOVERY: Proxy is now HEALTHY"
                    create_recovery_alert \
                        "Residential Proxy Recovered" \
                        "The SOCKS5 proxy at $PROXY_HOST:$PROXY_PORT is back online. Tailscale mesh restored."
                fi
                ;;
            degraded)
                log "🟡 WARNING: Proxy is DEGRADED ($failures checks failing)"
                create_db_alert \
                    "Residential Proxy Degraded" \
                    "The SOCKS5 proxy at $PROXY_HOST:$PROXY_PORT is partially failing ($failures/3 checks). Check Tailscale/3proxy on the net2app Windows machine." \
                    "warning"
                ;;
            down)
                log "🔴 CRITICAL: Proxy is DOWN — all checks failing!"
                create_db_alert \
                    "Residential Proxy DOWN" \
                    "The SOCKS5 proxy at $PROXY_HOST:$PROXY_PORT is completely unreachable. All checks failing: Tailscale, TCP port, and SOCKS5 traversal. OTT WhatsApp/Telegram messaging is affected." \
                    "error"
                ;;
        esac
    fi
    
    write_current_state "$current_state"
}

main
