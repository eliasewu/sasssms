#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  Net2APP Server Manager — Auto-Deploy Script
#  Called by: POST /api/super/servers (deploy=true)
#  Env vars:  DEPLOY_IP, DEPLOY_USER, DEPLOY_SSH_PASS, DEPLOY_SU_PASS
#  Arg 1:     LOCATION_ID (e.g. canada, france)
#
#  Strategy: lightweight provision (Node/PM2/PG/nginx) + rsync app
#  files from local server + remote build + PM2 start.
#  This replaces the old install.sh-from-/tmp approach which failed
#  because package.json was not in the CWD.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

IP="${DEPLOY_IP:-}"
SSH_USER="${DEPLOY_USER:-ubuntu}"
SSH_PASS="${DEPLOY_SSH_PASS:-}"
SU_PASS="${DEPLOY_SU_PASS:-${SSH_PASS}}"
LOCATION_ID="${1:-unknown}"
APP_DIR="/opt/net2app"

if [ -z "$IP" ] || [ -z "$SSH_PASS" ]; then
  echo "Usage: DEPLOY_IP=x DEPLOY_USER=x DEPLOY_SSH_PASS=x [DEPLOY_SU_PASS=x] bash $0 [LOCATION_ID]"
  exit 1
fi

log() { echo "[$(date '+%H:%M:%S')] $1"; }

# ── SSH/SCP/rsync helpers (password or key auth) ──
USE_SSHPASS=false

ssh_cmd() {
  if [ "$USE_SSHPASS" = true ]; then
    sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 "$SSH_USER@$IP" "$@"
  else
    ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 -o BatchMode=yes "$SSH_USER@$IP" "$@"
  fi
}

rsync_cmd() {
  if [ "$USE_SSHPASS" = true ]; then
    sshpass -e rsync -avz --delete \
      --exclude node_modules --exclude .next --exclude .git --exclude .server-creds --exclude .env \
      -e 'ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15' \
      "$@"
  else
    rsync -avz --delete \
      --exclude node_modules --exclude .next --exclude .git --exclude .server-creds --exclude .env \
      -e 'ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 -o BatchMode=yes' \
      "$@"
  fi
}

log "Deploying Net2APP to $IP ($LOCATION_ID) as $SSH_USER..."

# ── 1. Check connectivity (try SSH key first, then password) ──
log "Checking SSH connectivity..."

if ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes "$SSH_USER@$IP" "echo KEY_OK" 2>/dev/null; then
  log "SSH key auth OK"
else
  if [ -n "$SSH_PASS" ]; then
    log "Trying password auth..."
    export SSHPASS="$SSH_PASS"
    USE_SSHPASS=true
    if ! ssh_cmd "echo CONNECTED" 2>/dev/null; then
      echo "FAILED: Cannot SSH into $IP as $SSH_USER (key + password both failed)"
      exit 1
    fi
    log "SSH password auth OK"
  else
    echo "FAILED: Cannot SSH into $IP — no SSH key and no password provided"
    exit 1
  fi
fi

# ── 2. Lightweight provisioning (Node.js, PM2, PostgreSQL, nginx, redis) ──
log "Provisioning server (Node.js, PM2, PostgreSQL, nginx, redis)..."

# Run provisioning as root via sudo — installs only what's needed (no Asterisk)
# Pattern: password first line (for sudo -S), then heredoc script (for bash -s)
{ echo "$SU_PASS"; cat << 'PROVISION_EOF'; } | ssh_cmd "sudo -S bash -s" 2>&1 | tail -20
set -e
export DEBIAN_FRONTEND=noninteractive

# System packages
apt-get update -qq
apt-get install -y -qq curl wget git nginx redis-server build-essential 2>&1 | tail -3

# PostgreSQL
if ! command -v psql &>/dev/null; then
  apt-get install -y -qq postgresql postgresql-contrib 2>&1 | tail -3
  systemctl enable --now postgresql
fi
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='postgres'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER postgres WITH PASSWORD 'postgres' SUPERUSER;" 2>/dev/null || true
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='app_db'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE app_db OWNER postgres;"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';" 2>/dev/null || true
systemctl enable --now postgresql

# Node.js 22
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>&1 | tail -3
  apt-get install -y -qq nodejs 2>&1 | tail -3
fi

# PM2
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2 2>&1 | tail -3
fi

echo "PROVISION_DONE"
PROVISION_EOF

log "Provisioning complete"

# ── 3. Create app directory and rsync files from local server ──
log "Syncing application files to remote server..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_APP_DIR="$(dirname "$SCRIPT_DIR")"

# Ensure /opt/net2app exists on remote
echo "$SU_PASS" | ssh_cmd "sudo -S mkdir -p $APP_DIR && sudo chown $SSH_USER:$SSH_USER $APP_DIR" 2>/dev/null

# rsync app files (excluding heavy dirs) — this is the key fix!
# The old approach ran install.sh from /tmp where there was no package.json.
# Now we rsync the actual app files from the local server.
rsync_cmd "$LOCAL_APP_DIR/" "$SSH_USER@$IP:$APP_DIR/" 2>&1 | tail -5
log "Application files synced"

# ── 4. Setup .env, install deps, build, and start PM2 ──
log "Installing dependencies and building on remote server..."

# Generate .env with a unique JWT secret, then npm install + build + start
# Pattern: password first line (for sudo -S), then heredoc script (for bash -s)
{ echo "$SU_PASS"; cat << 'BUILD_EOF'; } | ssh_cmd "sudo -S bash -s" 2>&1 | tail -30
set -e
APP_DIR="/opt/net2app"
cd "$APP_DIR"

# Create .env if it doesn't exist (preserve existing .env on updates)
if [ ! -f "$APP_DIR/.env" ]; then
  JWT_SECRET="net2app-prod-$(date +%s)-$(openssl rand -hex 16)"
  cat > "$APP_DIR/.env" << ENVEOF
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
JWT_SECRET=$JWT_SECRET
NODE_ENV=production
PORT=5556
SMPP_PORT=2775
NEXT_PUBLIC_APP_URL=https://net2app.com
ENVEOF
  chmod 600 "$APP_DIR/.env"
  echo "Created new .env"
else
  echo "Preserved existing .env"
fi

# Install dependencies
npm install 2>&1 | tail -5

# Build the application
npm run build 2>&1 | tail -5

# Push database schema
npx drizzle-kit push 2>&1 | tail -3 || echo "DB_WARNING: drizzle push had issues (may need manual run)"

# Start with PM2
pm2 delete net2app 2>/dev/null || true
pm2 start npm --name net2app -- run start
pm2 save 2>/dev/null || true

echo "BUILD_DONE"
BUILD_EOF

log "Build complete"

# ── 5. Configure nginx ──
log "Configuring nginx..."

{ echo "$SU_PASS"; cat << 'NGINX_EOF'; } | ssh_cmd "sudo -S bash -s" 2>&1 | tail -10
set -e

# Generate self-signed cert if missing
if [ ! -f /etc/nginx/ssl/net2app.crt ] || [ ! -f /etc/nginx/ssl/net2app.key ]; then
  mkdir -p /etc/nginx/ssl
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/net2app.key \
    -out /etc/nginx/ssl/net2app.crt \
    -subj "/CN=net2app.com" 2>/dev/null
  chmod 600 /etc/nginx/ssl/net2app.key
fi

# Nginx site config (n8n proxy block only on Singapore where n8n runs)
if [ "$LOCATION_ID" = "singapore" ]; then
cat > /etc/nginx/sites-available/net2app << 'NGXCONF'
server {
    listen 80;
    server_name _;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl http2;
    server_name _;
    ssl_certificate /etc/nginx/ssl/net2app.crt;
    ssl_certificate_key /etc/nginx/ssl/net2app.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    client_max_body_size 100M;
    location /uploads/ {
        alias /opt/net2app/public/uploads/;
        try_files $uri =404;
        expires 1h;
        add_header Cache-Control "public";
    }
    # ── n8n /n8n/ redirect ──
    location = /n8n {
        return 302 /n8n2/;
    }
    location /n8n/ {
        return 302 /n8n2/;
    }
    # ── n8n at /n8n2/ — N8N_PATH=/n8n2/ handles routing natively ──
    location = /n8n2 {
        return 301 /n8n2/;
    }
    location /n8n2/ {
        # Strip the /n8n2/ prefix — n8n runs at root
        proxy_pass http://127.0.0.1:5678/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_buffering off;
        proxy_redirect off;
    }
    location / {
        proxy_pass http://127.0.0.1:5556;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
NGXCONF
else
cat > /etc/nginx/sites-available/net2app << 'NGXCONF'
server {
    listen 80;
    server_name _;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$host$request_uri; }
}
server {
    listen 443 ssl http2;
    server_name _;
    ssl_certificate /etc/nginx/ssl/net2app.crt;
    ssl_certificate_key /etc/nginx/ssl/net2app.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    client_max_body_size 100M;
    location /uploads/ {
        alias /opt/net2app/public/uploads/;
        try_files $uri =404;
        expires 1h;
        add_header Cache-Control "public";
    }
    location / {
        proxy_pass http://127.0.0.1:5556;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
NGXCONF
fi

ln -sf /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t 2>&1
systemctl reload nginx
systemctl enable nginx

# Open firewall ports
iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 2775 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 5556 -j ACCEPT 2>/dev/null || true

echo "NGINX_DONE"
NGINX_EOF

log "Nginx configured"

# ── 6. Install PM2 watchdog ──
log "Installing watchdog..."
{ echo "$SU_PASS"; cat << 'WATCHDOG_EOF'; } | ssh_cmd "sudo -S bash -s" 2>/dev/null || true
if [ -f /opt/net2app/scripts/net2app-watchdog.sh ]; then
  sudo cp /opt/net2app/scripts/net2app-watchdog.sh /usr/local/bin/net2app-watchdog 2>/dev/null
  sudo chmod +x /usr/local/bin/net2app-watchdog 2>/dev/null
  (crontab -l 2>/dev/null | grep -v net2app-watchdog; echo "*/2 * * * * /usr/local/bin/net2app-watchdog") | crontab - 2>/dev/null
  echo "Watchdog installed"
fi
WATCHDOG_EOF

# ── 7. Setup PM2 auto-start on boot ──
log "Setting up PM2 auto-start..."
{ echo "$SU_PASS"; cat << 'STARTUP_EOF'; } | ssh_cmd "sudo -S bash -s" 2>&1 | tail -5
STARTUP_CMD=$(PM2_HOME=/root/.pm2 pm2 startup systemd -u root --hp /root 2>/dev/null | grep 'sudo' | head -1)
if [ -n "$STARTUP_CMD" ]; then
  eval "$STARTUP_CMD" 2>/dev/null || true
fi
PM2_HOME=/root/.pm2 pm2 save 2>/dev/null || true
echo "PM2 startup configured"
STARTUP_EOF

# ── 8. Verify deployment ──
log "Verifying deployment..."
sleep 5

HEALTHY=true

# Check app port
APP_STATUS=$(ssh_cmd "curl -s -o /dev/null -w '%{http_code}' http://localhost:5556" 2>/dev/null || echo "000")
if [ "$APP_STATUS" = "200" ]; then
  log "App port 5556: HTTP 200 ✅"
else
  log "WARNING: App port 5556 returned HTTP $APP_STATUS"
  HEALTHY=false
fi

# Check PM2 (PM2 runs as root, so check with PM2_HOME=/root/.pm2)
PM2_STATUS=$(ssh_cmd "PM2_HOME=/root/.pm2 pm2 jlist 2>/dev/null | grep -o '\"status\":\"online\"' | head -1" 2>/dev/null || echo "")
if [ -n "$PM2_STATUS" ]; then
  log "PM2: online ✅"
else
  log "WARNING: PM2 not running"
  HEALTHY=false
fi

# Check nginx
NGINX_STATUS=$(ssh_cmd "systemctl is-active nginx 2>/dev/null" 2>/dev/null || echo "")
if [ "$NGINX_STATUS" = "active" ]; then
  log "Nginx: active ✅"
else
  log "WARNING: Nginx not active"
  HEALTHY=false
fi

# Check PostgreSQL
PG_STATUS=$(ssh_cmd "pg_isready 2>/dev/null" 2>/dev/null || echo "")
if echo "$PG_STATUS" | grep -q "accepting"; then
  log "PostgreSQL: ready ✅"
else
  log "WARNING: PostgreSQL not ready"
  HEALTHY=false
fi

# ── 9. Print summary ──
echo ""
echo "═══════════════════════════════════════"
if [ "$HEALTHY" = true ]; then
  echo "  ✅ Net2APP deployed successfully!"
  echo "  🌐 https://$IP"
  echo "  📱 App: $IP:5556"
  echo "  📍 Location: $LOCATION_ID"
else
  echo "  ⚠️  Deployment completed with warnings"
  echo "  Check: ssh $SSH_USER@$IP 'pm2 logs net2app'"
fi
echo "═══════════════════════════════════════"
