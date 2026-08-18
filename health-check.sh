#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  Net2APP SMS Platform — Health Check & Auto-Recovery Script
#  Run via cron every minute: * * * * * /opt/net2app/health-check.sh
# ═══════════════════════════════════════════════════════════════════

LOG_FILE="/var/log/net2app-health.log"
MAX_LOG_SIZE_MB=10
APP_PORT=5556
APP_DIR="/home/ubuntu/saas-sms-platform-architecture"
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

# Resolve the pm2 error log path for the net2app app. Prefers deterministic
# per-user paths (exact net2app logs) before falling back to `pm2 jlist`, whose
# first entry may belong to a different app on multi-app servers.
# Prints the log path if found, otherwise prints nothing.
resolve_pm2_err_log() {
    local err_log=""
    for p in "$HOME/.pm2/logs/net2app-error.log" "/root/.pm2/logs/net2app-error.log" "/home/ubuntu/.pm2/logs/net2app-error.log"; do
        if [ -f "$p" ]; then err_log="$p"; break; fi
    done
    if [ -z "$err_log" ]; then
        err_log=$(pm2 jlist 2>/dev/null | grep -o '"pm_err_log_path":"[^"]*"' | head -1 | cut -d'"' -f4)
    fi
    if [ -n "$err_log" ] && [ -f "$err_log" ]; then
        echo "$err_log"
    fi
}

# ── Check Net2APP static assets (CSS chunks referenced by served HTML) ──
# Detects a stale in-memory build manifest: the running server serves HTML that
# references hashed CSS files that no longer exist on disk (happens when .next is
# rebuilt/replaced while the app keeps running). Auto-restarts to load fresh manifest.
check_net2app_assets() {
    # Only meaningful when the app is actually up
    if ! ss -tlnp 2>/dev/null | grep -q ":$APP_PORT "; then
        return
    fi

    # Resolve the real app directory (pm2 may run the app from a cwd that owns .next)
    local app_cwd="$APP_DIR"
    local pm2_pid
    pm2_pid=$(pm2 pid net2app 2>/dev/null | tr -d '[:space:]')
    if [ -n "$pm2_pid" ] && [ -d "/proc/$pm2_pid" ]; then
        local resolved
        resolved=$(readlink -f "/proc/$pm2_pid/cwd" 2>/dev/null)
        [ -n "$resolved" ] && [ -d "$resolved" ] && app_cwd="$resolved"
    fi

    # Fetch the homepage the RUNNING server actually serves (in-memory manifest)
    local html css_urls missing=0 url disk_path
    html=$(curl -s --compressed --max-time 5 "http://127.0.0.1:$APP_PORT/" 2>/dev/null || true)
    [ -z "$html" ] && return

    # Extract referenced CSS asset URLs like /_next/static/chunks/abc.css
    css_urls=$(echo "$html" | grep -oE '/_next/static/[a-zA-Z0-9/_-]+\.css' | sort -u)

    for url in $css_urls; do
        disk_path="${app_cwd}/.next${url#/_next}"
        if [ ! -f "$disk_path" ]; then
            log "❌ CSS asset missing on disk: $disk_path (running server references it)"
            missing=1
        fi
    done

    if [ "$missing" -eq 1 ]; then
        # Cooldown: avoid restart storms (e.g. mid-build state)
        local cooldown_file="/tmp/net2app-css-restart"
        local now last
        now=$(date +%s)
        last=$(cat "$cooldown_file" 2>/dev/null || echo 0)
        if [ $((now - last)) -ge 120 ]; then
            log "❌ Stale build manifest — referenced CSS assets missing. Restarting net2app"
            if command -v pm2 &>/dev/null; then
                pm2 restart net2app 2>&1 >> "$LOG_FILE" || true
            fi
            echo "$now" > "$cooldown_file"
        else
            log "⚠️ CSS assets missing but within 120s cooldown — skipping restart"
        fi
    fi
}

# ── Check Net2APP /faq 500 (stale client-reference-manifest) ──
# Next.js throws InvariantError "The client reference manifest for route X does
# not exist" when the running server's in-memory manifest is stale vs .next on
# disk (same root cause as the CSS guard, but only surfaces on some routes like
# /faq). Probes /faq directly; on a 500 it confirms the manifest error is in the
# recent pm2 error log, then auto-restarts to load the fresh manifest.
check_net2app_manifest_500() {
    # Only meaningful when the app is actually up
    if ! ss -tlnp 2>/dev/null | grep -q ":$APP_PORT "; then
        return
    fi

    # Probe /faq — the route known to 500 when the manifest goes stale
    local faq_code
    faq_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$APP_PORT/faq" 2>/dev/null || true)
    if [ "$faq_code" != "500" ]; then
        return
    fi

    local err_log
    err_log=$(resolve_pm2_err_log)
    [ -z "$err_log" ] && return

    # Confirm this 500 is the stale-manifest error (recent tail only)
    if ! tail -n 200 "$err_log" 2>/dev/null | grep -q "client reference manifest for route"; then
        return
    fi

    # Cooldown: avoid restart storms
    local cooldown_file="/tmp/net2app-manifest-restart"
    local now last
    now=$(date +%s)
    last=$(cat "$cooldown_file" 2>/dev/null || echo 0)
    if [ $((now - last)) -ge 120 ]; then
        log "❌ /faq 500 — stale client reference manifest detected. Restarting net2app"
        if command -v pm2 &>/dev/null; then
            pm2 restart net2app 2>&1 >> "$LOG_FILE" || true
        fi
        echo "$now" > "$cooldown_file"
    else
        log "⚠️ /faq 500 (client reference manifest) but within 120s cooldown — skipping restart"
    fi
}

# ── Check Net2APP log for schema-mismatch errors (missing column) ──
# Postgres throws `column "x" of relation "y" does not exist` when a tenant's
# schema is missing a column the code expects (e.g. old tenants created before
# new columns existed). The self-healing createTenantSchema adds missing columns
# automatically on the tenant's next touch; a restart here clears any transient
# state and reloads the app so it can re-attempt the failed queries. Uses the
# same cooldown pattern as the other guards to avoid restart storms.
check_net2app_column_errors() {
    # Only meaningful when the app is actually up
    if ! ss -tlnp 2>/dev/null | grep -q ":$APP_PORT "; then
        return
    fi

    local err_log
    err_log=$(resolve_pm2_err_log)
    [ -z "$err_log" ] && return

    # Look for the Postgres missing-column error in the recent app error log
    local match_line col_name
    match_line=$(tail -n 200 "$err_log" 2>/dev/null | grep -E 'column "[^"]+" (of relation "[^"]+" )?does not exist' | tail -1)
    if [ -z "$match_line" ]; then
        return
    fi

    col_name=$(echo "$match_line" | grep -oE 'column "[^"]+"' | head -1 | sed 's/column //; s/"//g')

    # Cooldown: avoid restart storms
    local cooldown_file="/tmp/net2app-column-restart"
    local now last
    now=$(date +%s)
    last=$(cat "$cooldown_file" 2>/dev/null || echo 0)
    if [ $((now - last)) -ge 120 ]; then
        log "❌ Schema mismatch: missing column '$col_name' detected in app log: $match_line"
        log "   Self-healing createTenantSchema adds it on next tenant touch; restarting net2app to reload"
        if command -v pm2 &>/dev/null; then
            pm2 restart net2app 2>&1 >> "$LOG_FILE" || true
        fi
        echo "$now" > "$cooldown_file"
    else
        log "⚠️ Missing-column error detected but within 120s cooldown — skipping restart"
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
check_net2app_assets  # CSS integrity guard (stale build-manifest auto-recovery)
check_net2app_manifest_500  # /faq 500 guard (stale client-reference-manifest auto-recovery)
check_net2app_column_errors  # schema-mismatch guard (missing-column auto-restart + alert)
