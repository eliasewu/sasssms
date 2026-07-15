#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  Net2APP SMS Platform — Health Check & Auto-Recovery Script
#  Run via cron every minute: * * * * * /opt/net2app/health-check.sh
# ═══════════════════════════════════════════════════════════════════

LOG_FILE="/var/log/net2app-health.log"
MAX_LOG_SIZE_MB=10
APP_PORT=5555
APP_DIR="/opt/net2app"
LOCK_FILE="/tmp/net2app-health.lock"

# Prevent overlapping runs (cron runs every minute)
exec 200>"$LOCK_FILE"
if ! /usr/bin/flock -n 200; then
    # Another instance is still running, exit silently
    exit 0
fi

# Rotate log if too large
if [ -f "$LOG_FILE" ]; then
    LOG_SIZE=$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
    if [ "$LOG_SIZE" -gt $((MAX_LOG_SIZE_MB * 1024 * 1024)) ]; then
        mv "$LOG_FILE" "${LOG_FILE}.old"
    fi
fi

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

recover_service() {
    local service_name=$1
    local action=${2:-restart}
    log "Attempting to $action $service_name..."
    if systemctl "$action" "$service_name" 2>&1 >> "$LOG_FILE"; then
        log "SUCCESS: $service_name $action completed"
    else
        log "FAILED: Could not $action $service_name"
    fi
}

# ── Check PostgreSQL ──
check_postgresql() {
    if ! systemctl is-active --quiet postgresql; then
        log "❌ PostgreSQL is DOWN — attempting restart"
        recover_service postgresql restart
    fi
}

# ── Check Redis ──
check_redis() {
    if ! systemctl is-active --quiet redis-server; then
        log "❌ Redis is DOWN — attempting restart"
        recover_service redis-server restart
    fi
}

# ── Check Nginx ──
check_nginx() {
    if ! systemctl is-active --quiet nginx; then
        log "❌ Nginx is DOWN — attempting restart"
        recover_service nginx restart
    elif ! nginx -t &>/dev/null; then
        log "❌ Nginx config invalid — attempting reload"
        recover_service nginx reload
    fi
}

# ── Check Net2APP (PM2) ──
check_net2app() {
    # Check if PM2 process is online
    if command -v pm2 &>/dev/null; then
        local pm2_status
        pm2_status=$(pm2 jlist 2>/dev/null | grep -c '"status":"online"' || echo "0")
        if [ "$pm2_status" -eq 0 ]; then
            log "❌ Net2APP PM2 is DOWN — attempting resurrect"
            cd "$APP_DIR" || return
            pm2 resurrect 2>&1 >> "$LOG_FILE" || true
            sleep 3
            # If still down, force restart
            pm2_status=$(pm2 jlist 2>/dev/null | grep -c '"status":"online"' || echo "0")
            if [ "$pm2_status" -eq 0 ]; then
                log "❌ PM2 resurrect failed — starting fresh"
                pm2 start npm --name "net2app" -- run start 2>&1 >> "$LOG_FILE" || true
                pm2 save 2>&1 >> "$LOG_FILE" || true
            fi
        fi
    fi
    
    # Check if port is actually listening
    if ! ss -tlnp 2>/dev/null | grep -q ":$APP_PORT "; then
        log "❌ Port $APP_PORT NOT listening — restarting app"
        if command -v pm2 &>/dev/null; then
            pm2 restart net2app 2>&1 >> "$LOG_FILE" || true
        fi
    fi
}

# ── Check Asterisk (if installed) ──
check_asterisk() {
    if systemctl list-units --type=service | grep -q asterisk; then
        if ! systemctl is-active --quiet asterisk; then
            log "❌ Asterisk is DOWN — attempting restart"
            recover_service asterisk restart
        fi
    fi
}

# ── Check Postfix + Dovecot (if installed) ──
check_mail() {
    if systemctl list-units --type=service | grep -q postfix; then
        if ! systemctl is-active --quiet postfix; then
            log "❌ Postfix is DOWN — attempting restart"
            recover_service postfix restart
        fi
    fi
    if systemctl list-units --type=service | grep -q dovecot; then
        if ! systemctl is-active --quiet dovecot; then
            log "❌ Dovecot is DOWN — attempting restart"
            recover_service dovecot restart
        fi
    fi
}

# ── Check SOCKS5 Residential Proxy (Tailscale + 3proxy) ──
check_proxy() {
    log "[PROXY] Running proxy health check..."
    if [ -x "$APP_DIR/proxy-health-check.sh" ]; then
        "$APP_DIR/proxy-health-check.sh"
    fi
}

# ── Run all checks ──
check_postgresql
check_redis
check_nginx
check_asterisk
check_mail
check_proxy      # Check proxy BEFORE app (OTT depends on it)
check_net2app    # Check app LAST (depends on DB + Redis + Proxy)
