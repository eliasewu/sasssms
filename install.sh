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
echo "  Tri Angle Trade Centre Fze LLC"
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

# ── 8. PM2 & Nginx ──
echo "[8/9] PM2 + Nginx..."
command -v pm2 &>/dev/null || npm install -g pm2
pm2 delete net2app 2>/dev/null || true
pm2 start npm --name "net2app" -- start --cwd "$APP_DIR"
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

cat > /etc/nginx/sites-available/net2app <<'NGX'
server {
    listen 80; server_name _;
    client_max_body_size 100M;
    location / { proxy_pass http://127.0.0.1:5555; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection 'upgrade'; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_read_timeout 300s; }
    location /api/webhooks/ { proxy_pass http://127.0.0.1:5555; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
NGX
ln -sf /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 9. Firewall ──
echo "[9/9] Firewall..."
iptables -I INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 2775 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p tcp --dport 5555 -j ACCEPT 2>/dev/null || true
iptables -I INPUT -p udp --dport 5060 -j ACCEPT 2>/dev/null || true

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""; echo "═══════════════════════════════════════"
echo "  ✅ Net2APP Installation Complete!"
echo "═══════════════════════════════════════"
echo "  Landing:     http://$SERVER_IP"
echo "  Super Admin: http://$SERVER_IP/super"
echo "  SMPP Port:   2775 (ESME/SMSC)"
echo "  Voice OTP:   5060 (Asterisk SIP)"
echo "  AMI Port:    5038 (admin/Telco1988)"
echo "  App Port:    5555"
echo ""
echo "  Setup Super Admin:"
echo "  Key: SETUP_SMS_PLATFORM_2024"
echo ""
echo "  Manage: pm2 logs net2app"
echo "═══════════════════════════════════════"
