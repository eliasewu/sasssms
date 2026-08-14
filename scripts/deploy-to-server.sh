#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  Net2APP Server Manager — Full Auto-Deploy Script (a2z install)
#  Called by: POST /api/super/servers (deploy=true) — runs asynchronously
#  Env vars:  DEPLOY_IP, DEPLOY_USER, DEPLOY_SSH_PASS, DEPLOY_SU_PASS,
#             DEPLOY_SMPP_PORT (default 2775)
#  Arg 1:     LOCATION_ID (e.g. canada, france)
#
#  Installs the FULL platform on the target server, exactly like install.sh:
#    Node.js 22, PostgreSQL, Redis, Nginx, Java 21, Asterisk 20 (Voice OTP),
#    Tailscale + 3proxy (OTT), PM2 + systemd auto-start, health-check cron,
#    nightly schema-heal cron, and the Net2APP app itself.
#  App files are rsynced from THIS server (the super-admin box) to the target.
#  SMPP port comes from DEPLOY_SMPP_PORT (default 2775).
#
#  Success marker written at the end: "✅ Net2APP deployed successfully!"
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

IP="${DEPLOY_IP:-}"
SSH_USER="${DEPLOY_USER:-ubuntu}"
SSH_PASS="${DEPLOY_SSH_PASS:-}"
SU_PASS="${DEPLOY_SU_PASS:-${SSH_PASS}}"
LOCATION_ID="${1:-unknown}"
SMPP_PORT="${DEPLOY_SMPP_PORT:-2775}"
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
      --exclude public/uploads \
      -e 'ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15' \
      "$@"
  else
    rsync -avz --delete \
      --exclude node_modules --exclude .next --exclude .git --exclude .server-creds --exclude .env \
      --exclude public/uploads \
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

# ── 1b. Detect whether sudo needs a password ──
# Fresh cloud images (OVH, etc.) often ship with passwordless sudo (NOPASSWD).
# Feeding a password line into `sudo -S bash -s` on such hosts leaks that line
# into the script as its first command -> "command not found" -> `set -e` aborts
# provisioning (exactly what happened on 139.99.148.177). Only send the
# password when sudo actually requires one.
SUDO_NEEDS_PASSWORD=true
if ssh_cmd "sudo -n true" 2>/dev/null; then
  SUDO_NEEDS_PASSWORD=false
  log "Passwordless sudo detected (NOPASSWD) — skipping sudo password"
fi

# Emits the sudo password ONLY when sudo requires one. Pipe this before a
# heredoc into `sudo -S bash -s`.
sudo_stdin() {
  if [ "$SUDO_NEEDS_PASSWORD" = "true" ]; then
    echo "$SU_PASS"
  fi
}

# ── 2. Full a2z provisioning (Node.js, PostgreSQL, Redis, Nginx, Java 21,
#        Asterisk 20, Tailscale, 3proxy) ──
log "Provisioning full platform stack (Node, PG, Redis, Nginx, Java 21, Asterisk 20, Tailscale)..."

# Run provisioning as root via sudo. Pattern: sudo password first line (only
# when sudo needs one), then heredoc script (for bash -s).
{ sudo_stdin; cat << 'PROVISION_EOF'; } | ssh_cmd "sudo -S bash -s" 2>&1 | tail -25
set -e
export DEBIAN_FRONTEND=noninteractive

# System packages
apt-get update -qq
apt-get install -y -qq curl wget git nginx redis-server build-essential unzip certbot python3-certbot-nginx 2>&1 | tail -3

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
systemctl enable --now redis-server 2>/dev/null || true

# Node.js 22
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - 2>&1 | tail -3
  apt-get install -y -qq nodejs 2>&1 | tail -3
fi

# PM2
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2 2>&1 | tail -3
fi

# Java 21 (SMPP SMSC/ESME helpers)
if ! command -v java &>/dev/null || ! java -version 2>&1 | grep -q "21"; then
  apt-get install -y -qq openjdk-21-jdk openjdk-21-jre 2>&1 | tail -3 || echo "WARN: Java 21 install had issues (Voice OTP SMSC helper may be unavailable)"
fi

# Asterisk 20 (Voice OTP) — best-effort; skip if it takes too long on weak boxes
if ! command -v asterisk &>/dev/null; then
  echo "Installing Asterisk 20 (Voice OTP) — this can take 10-20 min..."
  apt-get install -y -qq build-essential libssl-dev libncurses5-dev libnewt-dev libxml2-dev libsqlite3-dev uuid-dev libjansson-dev libedit-dev libgsm1-dev mpg123 sox unixodbc unixodbc-dev pkg-config liblua5.2-dev libspeex-dev libspeexdsp-dev libogg-dev libvorbis-dev libcurl4-openssl-dev 2>&1 | tail -3 || true
  apt-get install -y -qq libsrtp2-dev 2>/dev/null || true
  cd /usr/src
  rm -rf asterisk-20*/
  wget -q https://downloads.asterisk.org/pub/telephony/asterisk/asterisk-20-current.tar.gz -O asterisk-20.tar.gz || echo "WARN: Asterisk download failed — Voice OTP will be unavailable"
  if [ -f asterisk-20.tar.gz ]; then
    tar -xzf asterisk-20.tar.gz
    ASTERISK_DIR=$(find /usr/src -maxdepth 1 -name "asterisk-20*" -type d | head -1)
    cd "$ASTERISK_DIR"
    [ -f contrib/scripts/install_prereq ] && contrib/scripts/install_prereq install 2>&1 | tail -3 || true
    ./configure --with-jansson-bundled --with-pjproject-bundled 2>&1 | tail -3
    make menuselect.makeopts 2>/dev/null || true
    menuselect/menuselect --enable chan_sip --enable chan_pjsip --enable res_pjsip --enable codec_gsm --enable codec_ulaw --enable codec_alaw --enable app_dial --enable app_playback menuselect.makeopts 2>/dev/null || true
    make -j$(nproc) 2>&1 | tail -5
    make install 2>&1 | tail -3
    make samples 2>&1 | tail -2 || true
    make config 2>&1 | tail -2 || true
    ldconfig
    id asterisk &>/dev/null || useradd -r -d /var/lib/asterisk -s /sbin/nologin -c "Asterisk" asterisk || true
    for D in /etc/asterisk /var/lib/asterisk /var/log/asterisk /var/spool/asterisk /usr/lib/asterisk /var/run/asterisk; do [ -d "$D" ] && chown -R asterisk:asterisk "$D" || true; done
    cat > /etc/asterisk/sip.conf <<'SIP'
[general]
context=default; bindport=5060; bindaddr=0.0.0.0; language=en
disallow=all; allow=ulaw; allow=alaw; allow=gsm
nat=force_rport,comedia; qualify=yes
SIP
    cat > /etc/asterisk/manager.conf <<'AMI'
[general]
enabled=yes; port=5038; bindaddr=127.0.0.1; displayconnects=yes
[admin]
secret=Telco1988; deny=0.0.0.0/0.0.0.0; permit=127.0.0.1/255.255.255.0; read=all; write=all
[net2app]
secret=Telco1988; deny=0.0.0.0/0.0.0.0; permit=127.0.0.1/255.255.255.0; read=all; write=all
AMI
    chown -R asterisk:asterisk /etc/asterisk || true
    systemctl daemon-reload || true
    systemctl enable asterisk 2>/dev/null || true
    systemctl start asterisk 2>/dev/null || true
    echo "Asterisk 20 installed"
  fi
fi

# Tailscale + 3proxy (OTT residential proxy)
command -v tailscale &>/dev/null || curl -fsSL https://tailscale.com/install.sh | sh 2>&1 | tail -2 || true
apt-get install -y -qq 3proxy 2>/dev/null || true

echo "PROVISION_DONE"
PROVISION_EOF

log "Provisioning complete"

# ── 3. Create app directory and rsync files from local server ──
log "Syncing application files to remote server..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOCAL_APP_DIR="$(dirname "$SCRIPT_DIR")"

# Ensure /opt/net2app exists on remote
sudo_stdin | ssh_cmd "sudo -S mkdir -p $APP_DIR && sudo chown $SSH_USER:$SSH_USER $APP_DIR" 2>/dev/null

# rsync app files (excluding heavy dirs) — this is the key fix!
# The old approach ran install.sh from /tmp where there was no package.json.
# Now we rsync the actual app files from the local server.
rsync_cmd "$LOCAL_APP_DIR/" "$SSH_USER@$IP:$APP_DIR/" 2>&1 | tail -5
log "Application files synced"

# ── 3b. Sync the Android APK artifact so /api/tenant/android-app/download
#        works on the new server. The APK is a separate build artifact that
#        lives in /opt/net2app/android-app (this box's deployed copy).
#        Fall back to the repo dir for local (dev) runs. ──
APK_SRC="$LOCAL_APP_DIR/android-app"
[ -d "/opt/net2app/android-app" ] && ls /opt/net2app/android-app/*.apk >/dev/null 2>&1 && APK_SRC="/opt/net2app/android-app"
if [ -d "$APK_SRC" ] && ls "$APK_SRC/"*.apk >/dev/null 2>&1; then
  log "Syncing Android APK from $APK_SRC..."
  sudo_stdin | ssh_cmd "sudo -S mkdir -p $APP_DIR/android-app && sudo chown $SSH_USER:$SSH_USER $APP_DIR/android-app" 2>/dev/null
  rsync_cmd "$APK_SRC/" "$SSH_USER@$IP:$APP_DIR/android-app/" 2>&1 | tail -2
  log "Android APK synced"
else
  log "WARN: No APK found locally — APK download will 404 until it's uploaded"
fi

# ── 4. Setup .env, install deps, build, and start PM2 ──
log "Installing dependencies and building on remote server..."

# Generate .env with a unique JWT secret, then npm install + build + start
# Pattern: sudo password first line (only when sudo needs one), then heredoc
# script (for bash -s)
{ sudo_stdin; cat << 'BUILD_EOF'; } | ssh_cmd "sudo -S bash -s" 2>&1 | tail -30
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
SMPP_PORT=$SMPP_PORT
NEXT_PUBLIC_APP_URL=https://net2app.com
ENVEOF
  chmod 600 "$APP_DIR/.env"
  echo "Created new .env (SMPP_PORT=$SMPP_PORT)"
else
  # Ensure SMPP_PORT is set even on updates
  grep -q '^SMPP_PORT=' "$APP_DIR/.env" || echo "SMPP_PORT=$SMPP_PORT" >> "$APP_DIR/.env"
  echo "Preserved existing .env (SMPP_PORT ensured)"
fi

# Install dependencies
npm install 2>&1 | tail -5

# Build the application
npm run build 2>&1 | tail -5

# Push database schema
npx drizzle-kit push 2>&1 | tail -3 || echo "DB_WARNING: drizzle push had issues (may need manual run)"

# Tenant schema column backfill (drizzle/0040) — idempotent
if [ -f "$APP_DIR/drizzle/0040_add_suppliers_updated_at_columns.sql" ]; then
  psql "postgresql://postgres:postgres@127.0.0.1:5432/app_db" -f "$APP_DIR/drizzle/0040_add_suppliers_updated_at_columns.sql" 2>&1 | tail -2 || echo "DB_WARNING: 0040 backfill skipped"
fi

# Start with PM2
pm2 delete net2app 2>/dev/null || true
pm2 start npm --name net2app -- run start
pm2 save 2>/dev/null || true

echo "BUILD_DONE"
BUILD_EOF

log "Build complete"

# ── 5. Configure nginx ──
log "Configuring nginx..."

{ sudo_stdin; cat << 'NGINX_EOF'; } | ssh_cmd "sudo -S bash -s" 2>&1 | tail -10
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
iptables -I INPUT -p tcp --dport $SMPP_PORT -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 5556 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p udp --dport 5060 -j ACCEPT 2>/dev/null || true

echo "NGINX_DONE"
NGINX_EOF

log "Nginx configured"

# ── 6. Install PM2 watchdog ──
log "Installing watchdog..."
{ sudo_stdin; cat << 'WATCHDOG_EOF'; } | ssh_cmd "sudo -S bash -s" 2>/dev/null || true
if [ -f /opt/net2app/scripts/net2app-watchdog.sh ]; then
  sudo cp /opt/net2app/scripts/net2app-watchdog.sh /usr/local/bin/net2app-watchdog 2>/dev/null
  sudo chmod +x /usr/local/bin/net2app-watchdog 2>/dev/null
  (crontab -l 2>/dev/null | grep -v net2app-watchdog; echo "*/2 * * * * /usr/local/bin/net2app-watchdog") | crontab - 2>/dev/null
  echo "Watchdog installed"
fi
WATCHDOG_EOF

# ── 6b. systemd auto-start service + health-check cron + schema-heal cron ──
log "Installing systemd service + monitoring crons..."
{ sudo_stdin; cat << 'SVC_EOF'; } | ssh_cmd "sudo -S bash -s" 2>&1 | tail -8
set -e
APP_DIR="/opt/net2app"

# Dedicated systemd unit for PM2 resurrection on boot
cat > /etc/systemd/system/net2app.service << 'SVCUNIT'
[Unit]
Description=Net2APP SMS Platform (Next.js)
After=network-online.target postgresql.service redis-server.service
Wants=network-online.target postgresql.service redis-server.service

[Service]
Type=forking
User=root
Environment=PATH=/usr/bin:/usr/local/bin:/usr/local/sbin:/usr/sbin:/sbin:/bin
Environment=NODE_ENV=production
Environment=PM2_HOME=/root/.pm2
WorkingDirectory=/opt/net2app
ExecStart=/usr/bin/pm2 resurrect
ExecReload=/usr/bin/pm2 reload all
ExecStop=/usr/bin/pm2 kill
Restart=always
RestartSec=10
TimeoutStartSec=60
TimeoutStopSec=30
StartLimitIntervalSec=300
StartLimitBurst=5
KillMode=mixed

[Install]
WantedBy=multi-user.target
SVCUNIT

systemctl disable pm2-root.service 2>/dev/null || true
systemctl daemon-reload
systemctl enable net2app.service 2>/dev/null || true

# health-check.sh ships with the app source (rsynced above)
if [ -f "$APP_DIR/health-check.sh" ]; then
  chmod +x "$APP_DIR/health-check.sh"
  (crontab -l 2>/dev/null | grep -v health-check.sh; echo "* * * * * /opt/net2app/health-check.sh") | crontab - 2>/dev/null || true
  echo "Health-check cron installed"
fi

# Nightly schema-heal cron
if [ -f "$APP_DIR/scripts/heal-schemas-cron.sh" ]; then
  chmod +x "$APP_DIR/scripts/heal-schemas-cron.sh"
  (crontab -l 2>/dev/null | grep -v heal-schemas-cron.sh; echo "0 3 * * * /opt/net2app/scripts/heal-schemas-cron.sh") | crontab - 2>/dev/null || true
  echo "Schema-heal cron installed"
fi

systemctl enable --now postgresql 2>/dev/null || true
systemctl enable --now redis-server 2>/dev/null || true
systemctl enable --now nginx 2>/dev/null || true
if systemctl list-units --type=service 2>/dev/null | grep -q asterisk; then
  systemctl enable --now asterisk 2>/dev/null || true
fi

echo "SVC_DONE"
SVC_EOF

# ── 7. Setup PM2 auto-start on boot ──
log "Setting up PM2 auto-start..."
{ sudo_stdin; cat << 'STARTUP_EOF'; } | ssh_cmd "sudo -S bash -s" 2>&1 | tail -5
STARTUP_CMD=$(PM2_HOME=/root/.pm2 pm2 startup systemd -u root --hp /root 2>/dev/null | grep 'sudo' | head -1)
if [ -n "$STARTUP_CMD" ]; then
  eval "$STARTUP_CMD" 2>/dev/null || true
fi
PM2_HOME=/root/.pm2 pm2 save 2>/dev/null || true
echo "PM2 startup configured"
STARTUP_EOF

# ── 8. Verify deployment ──
log "Verifying deployment..."
sleep 8

HEALTHY=true

# Check app port
APP_STATUS=$(ssh_cmd "curl -s -o /dev/null -w '%{http_code}' http://localhost:5556" 2>/dev/null || echo "000")
if [ "$APP_STATUS" = "200" ]; then
  log "App port 5556: HTTP 200 ✅"
else
  log "WARNING: App port 5556 returned HTTP $APP_STATUS"
  HEALTHY=false
fi

# Check SMPP port
SMPP_STATUS=$(ssh_cmd "ss -tlnp 2>/dev/null | grep -c ':$SMPP_PORT '" 2>/dev/null || echo "0")
if [ "$SMPP_STATUS" != "0" ]; then
  log "SMPP port $SMPP_PORT: listening ✅"
else
  log "WARNING: SMPP port $SMPP_PORT not listening"
  HEALTHY=false
fi

# Check PM2 — runs as root on some servers, as ubuntu on others, so probe
# both (root's PM2 requires sudo since ssh_cmd runs as the SSH user).
PM2_STATUS=$(ssh_cmd "sudo PM2_HOME=/root/.pm2 pm2 jlist 2>/dev/null | grep -o '\"status\":\"online\"' | head -1" 2>/dev/null || echo "")
if [ -z "$PM2_STATUS" ]; then
  PM2_STATUS=$(ssh_cmd "PM2_HOME=/home/ubuntu/.pm2 pm2 jlist 2>/dev/null | grep -o '\"status\":\"online\"' | head -1" 2>/dev/null || echo "")
fi
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
  echo "  📡 SMPP: $IP:$SMPP_PORT"
  echo "  📍 Location: $LOCATION_ID"
else
  echo "  ⚠️  Deployment completed with warnings"
  echo "  Check: ssh $SSH_USER@$IP 'pm2 logs net2app'"
fi
echo "═══════════════════════════════════════"
