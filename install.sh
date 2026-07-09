#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
#  Net2APP SMS Platform — Complete Ubuntu 22/24 Deploy Script
#  Run: sudo bash install.sh
#  Includes: Node.js, PostgreSQL, Asterisk 20, SMPP, Voice OTP, Nginx
# ═══════════════════════════════════════════════════════════════════════
set -e
if [ "$EUID" -ne 0 ]; then exec sudo bash "$0" "$@"; fi

APP_DIR="/opt/net2app"
DB_USER="postgres"
DB_PASS="postgres"
DB_NAME="app_db"
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok(){ echo -e "${GREEN}[OK]${NC} $1"; }
info(){ echo -e "${YELLOW}[i]${NC} $1"; }

IS_UPDATE=false
[ -d "$APP_DIR" ] && IS_UPDATE=true && info "UPDATE mode - preserving configs"

echo ""; echo "============================================"
echo "  Net2APP Platform Installer"
echo "  Tri Angle Trade Centre FZE LLC"
echo "============================================"

# ── 1. System Dependencies ──
echo "[1/9] System packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl wget git build-essential unzip nginx certbot python3-certbot-nginx redis-server
ok "System packages"

# ── 2. PostgreSQL ──
echo "[2/9] PostgreSQL..."
if ! command -v psql &>/dev/null; then apt-get install -y -qq postgresql postgresql-contrib; systemctl enable --now postgresql; fi
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS' SUPERUSER;"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
ok "PostgreSQL ready"

# ── 3. Node.js 22 ──
echo "[3/9] Node.js..."
if ! command -v node &>/dev/null; then curl -fsSL https://deb.nodesource.com/setup_22.x | bash -; apt-get install -y -qq nodejs; fi
ok "Node.js $(node -v)"

# ── 4. Java 21 (SMPP SMSC/ESME) ──
echo "[4/9] Java 21 for SMPP..."
if ! command -v java &>/dev/null || ! java -version 2>&1 | grep -q "21"; then
  apt-get install -y -qq openjdk-21-jdk openjdk-21-jre
fi
ok "Java $(java -version 2>&1 | head -1)"

# ── 5. Asterisk 20 (Voice OTP 20+ channels) ──
echo "[5/9] Asterisk 20..."
if ! command -v asterisk &>/dev/null; then
  info "Installing Asterisk 20..."
  apt-get install -y -qq build-essential libssl-dev libncurses5-dev libnewt-dev libxml2-dev libsqlite3-dev uuid-dev libjansson-dev libedit-dev libgsm1-dev mpg123 sox unixodbc unixodbc-dev pkg-config liblua5.2-dev libspeex-dev libspeexdsp-dev libogg-dev libvorbis-dev libcurl4-openssl-dev
  apt-get install -y -qq libsrtp2-dev 2>/dev/null || true

  cd /usr/src
  rm -rf asterisk-20*/
  wget -q https://downloads.asterisk.org/pub/telephony/asterisk/asterisk-20-current.tar.gz -O asterisk-20.tar.gz
  tar -xzf asterisk-20.tar.gz
  ASTERISK_DIR=$(find /usr/src -maxdepth 1 -name "asterisk-20*" -type d | head -1)
  cd "$ASTERISK_DIR"
  
  [ -f contrib/scripts/install_prereq ] && contrib/scripts/install_prereq install 2>&1 | tail -3 || true
  ./configure --with-jansson-bundled --with-pjproject-bundled 2>&1 | tail -3
  make menuselect.makeopts 2>/dev/null
  menuselect/menuselect --enable chan_sip --enable chan_pjsip --enable res_pjsip --enable codec_gsm --enable codec_ulaw --enable codec_alaw --enable app_dial --enable app_playback menuselect.makeopts 2>/dev/null || true
  make -j$(nproc) 2>&1 | tail -5
  make install 2>&1 | tail -3
  make samples 2>&1 | tail -2
  make config 2>&1 | tail -2
  ldconfig

  # Create user
  id asterisk &>/dev/null || useradd -r -d /var/lib/asterisk -s /sbin/nologin -c "Asterisk" asterisk
  for D in /etc/asterisk /var/lib/asterisk /var/log/asterisk /var/spool/asterisk /usr/lib/asterisk /var/run/asterisk; do [ -d "$D" ] && chown -R asterisk:asterisk "$D" || true; done

  # Config files
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

  chown -R asterisk:asterisk /etc/asterisk
  systemctl daemon-reload
  systemctl enable asterisk
  systemctl start asterisk
  sleep 3
  ok "Asterisk installed"
else
  ok "Asterisk already installed"
fi

# ── 6. Tailscale/3proxy for OTT ──
echo "[6/9] Residential proxy..."
command -v tailscale &>/dev/null || curl -fsSL https://tailscale.com/install.sh | sh
apt-get install -y -qq 3proxy 2>/dev/null || true
ok "Proxy tools ready"

# ── 7. Deploy Application ──
echo "[7/9] Deploying Net2APP..."
if [ "$IS_UPDATE" = false ]; then
  mkdir -p "$APP_DIR"
  [ -f "package.json" ] && cp -r . "$APP_DIR/"
else
  cp "$APP_DIR/.env" /tmp/net2app_env_bak 2>/dev/null || true
  cp -r "$APP_DIR/public/uploads" /tmp/net2app_up_bak 2>/dev/null || true
  find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name 'node_modules' -exec rm -rf {} +
  [ -f "package.json" ] && cp -r . "$APP_DIR/"
  cp /tmp/net2app_env_bak "$APP_DIR/.env" 2>/dev/null || true
  cp -r /tmp/net2app_up_bak "$APP_DIR/public/uploads" 2>/dev/null || true
fi

cd "$APP_DIR"
chown -R root:root "$APP_DIR"

# Create .env if missing
[ ! -f "$APP_DIR/.env" ] && cat > "$APP_DIR/.env" <<'EOF'
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
JWT_SECRET=net2app-production-change-me-2024
NODE_ENV=production
PORT=5555
EOF

npm install
npm run build

# Push schema
npx drizzle-kit push 2>&1 | tail -3 || info "Schema push - check manually"

# ── 8. PM2, Systemd Service & Auto-Recovery ──
echo "[8/9] PM2 + Systemd + Auto-Recovery..."
command -v pm2 &>/dev/null || npm install -g pm2

# ── Enable all core services for auto-start on boot ──
systemctl enable --now postgresql 2>/dev/null || true
systemctl enable --now redis-server 2>/dev/null || true
systemctl enable --now nginx 2>/dev/null || true

# Enable Asterisk if installed
if systemctl list-units --type=service 2>/dev/null | grep -q asterisk; then
  systemctl enable --now asterisk 2>/dev/null || true
fi

# PM2: Start app
set +e
pm2 delete net2app 2>/dev/null || true
pm2 start npm --name "net2app" -- start --cwd "$APP_DIR"
pm2 save
set -e

# ── Create dedicated systemd service for PM2 resurrection ──
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

# Disable PM2's auto-generated service to avoid duplicate startups
systemctl disable pm2-root.service 2>/dev/null || true

systemctl daemon-reload
systemctl enable net2app.service 2>/dev/null || true

# ── Install health-check monitoring script (cron every minute) ──
cat > "$APP_DIR/health-check.sh" << 'HCSCRIPT'
#!/bin/bash
LOG_FILE="/var/log/net2app-health.log"
APP_PORT=5555
LOCK_FILE="/tmp/net2app-health.lock"
exec 200>"$LOCK_FILE"
/usr/bin/flock -n 200 || exit 0
if [ -f "$LOG_FILE" ]; then
    LOG_SIZE=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
    if [ "$LOG_SIZE" -gt 10485760 ]; then mv "$LOG_FILE" "${LOG_FILE}.old"; fi
fi
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }
recover() {
    log "Restarting $1..."
    systemctl restart "$1" 2>&1 >> "$LOG_FILE" && log "SUCCESS: $1 restarted" || log "FAILED: $1 restart"
}
systemctl is-active --quiet postgresql || recover postgresql
systemctl is-active --quiet redis-server || recover redis-server
if ! systemctl is-active --quiet nginx; then recover nginx
elif ! nginx -t &>/dev/null; then systemctl reload nginx 2>&1 >> "$LOG_FILE" || true; fi
if systemctl list-units --type=service 2>/dev/null | grep -q asterisk; then
    systemctl is-active --quiet asterisk || recover asterisk
fi
PM2_DOWN=false
if command -v pm2 &>/dev/null; then
    ONLINE_COUNT=$(pm2 jlist 2>/dev/null | grep -c '"status":"online"' || echo 0)
    [ "$ONLINE_COUNT" -eq 0 ] && PM2_DOWN=true
else
    PM2_DOWN=true
fi
if [ "$PM2_DOWN" = true ] || ! ss -tlnp 2>/dev/null | grep -q ":$APP_PORT "; then
    log "Net2APP down (PM2: $PM2_DOWN, port: $APP_PORT) — resurrecting"
    cd /opt/net2app
    pm2 resurrect 2>&1 >> "$LOG_FILE" || true
    sleep 3
    if ! ss -tlnp 2>/dev/null | grep -q ":$APP_PORT "; then
        log "Port still down — forcing fresh PM2 start"
        pm2 start npm --name "net2app" -- run start 2>&1 >> "$LOG_FILE" || true
        pm2 save 2>&1 >> "$LOG_FILE" || true
    fi
fi
HCSCRIPT

chmod +x "$APP_DIR/health-check.sh"

# Install cron jobs for monitoring
set +e
(crontab -l 2>/dev/null | grep -v health-check.sh; echo "* * * * * /opt/net2app/health-check.sh") | crontab - 2>/dev/null || true
(crontab -l 2>/dev/null | grep -v 'pm2 resurrect'; echo "@reboot sleep 10 && /usr/bin/pm2 resurrect") | crontab - 2>/dev/null || true
set -e

ok "Systemd + monitoring cron installed"

# ── 9. Nginx + Firewall ──
echo "[9/9] Nginx + Firewall..."

cat > /etc/nginx/sites-available/net2app <<'NGX'
# HTTP → HTTPS redirect
server {
    listen 80; server_name _;
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$host$request_uri; }
}

# HTTPS with Cloudflare-compatible origin cert
server {
    listen 443 ssl http2; server_name _;
    ssl_certificate /etc/nginx/ssl/net2app.crt;
    ssl_certificate_key /etc/nginx/ssl/net2app.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    client_max_body_size 100M;
    location / {
        proxy_pass http://127.0.0.1:5555;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
    location /api/webhooks/ { proxy_pass http://127.0.0.1:5555; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
NGX

# Generate Cloudflare-compatible origin cert if missing
if [ ! -f "/etc/nginx/ssl/net2app.crt" ] || [ ! -f "/etc/nginx/ssl/net2app.key" ]; then
    info "Generating Cloudflare-compatible origin certificate..."
    mkdir -p /etc/nginx/ssl
    cat > /tmp/openssl-san.cnf << 'CNF'
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = req_ext
[dn]
CN = net2app.com
[req_ext]
subjectAltName = @alt_names
[alt_names]
DNS.1 = net2app.com
DNS.2 = www.net2app.com
CNF
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/net2app.key \
      -out /etc/nginx/ssl/net2app.crt \
      -config /tmp/openssl-san.cnf \
      -extensions req_ext 2>/dev/null
    rm -f /tmp/openssl-san.cnf
    chmod 600 /etc/nginx/ssl/net2app.key
    ok "Origin cert generated (10-year, SANs: net2app.com)"
fi

ln -sf /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Service status summary
echo ""
echo "  Service Status:"
systemctl is-active postgresql 2>/dev/null && echo "    ✅ PostgreSQL" || echo "    ❌ PostgreSQL"
systemctl is-active redis-server 2>/dev/null && echo "    ✅ Redis" || echo "    ❌ Redis"
systemctl is-active nginx 2>/dev/null && echo "    ✅ Nginx" || echo "    ❌ Nginx"
systemctl is-enabled net2app.service 2>/dev/null && echo "    ✅ Net2APP (auto-start)" || echo "    ❌ Net2APP (not enabled)"
ss -tlnp 2>/dev/null | grep -q ":5555 " && echo "    ✅ Port 5555 listening" || echo "    ❌ Port 5555 NOT listening"
iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 2775 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 5555 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p udp --dport 5060 -j ACCEPT 2>/dev/null || true

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""; echo "═══════════════════════════════════════"
echo "  ✅ Net2APP Installation Complete!"
echo "═══════════════════════════════════════"
echo "  ⚠️  Cloudflare: Set SSL/TLS mode to 'Full' in Cloudflare dashboard"
echo "  Landing:     https://net2app.com"
echo "  Super Admin: https://net2app.com/super"
echo "  SMPP Port:   2775 (ESME/SMSC)"
echo "  Voice OTP:   5060 (Asterisk SIP)"
echo "  AMI Port:    5038 (admin/Telco1988)"
echo "  App Port:    5555"
echo ""
echo "  Setup Super Admin:"
echo "  Key: SETUP_SMS_PLATFORM_2024"
echo ""
echo "  Manage: pm2 logs net2app"
echo "  Health: tail -f /var/log/net2app-health.log"
echo "═══════════════════════════════════════"
