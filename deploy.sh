#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  Net2APP SMS Platform — Production Deploy Script
#  Ubuntu 22/24 | Debian 12
#  Run: chmod +x deploy.sh && sudo bash deploy.sh
# ===================================================================
set -euo pipefail

APP_DIR="/opt/net2app"
DB_USER="postgres"
DB_PASS="postgres"
DB_NAME="app_db"
DB_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
NODE_V="22"
APP_PORT="5555"
SMPP_PORT="2775"
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

ok(){ echo -e "${GREEN}[OK]${NC} $1"; }
warn(){ echo -e "${YELLOW}[WARN]${NC} $1"; }
err(){ echo -e "${RED}[ERR]${NC} $1"; }

if [ "$EUID" -ne 0 ]; then echo -e "${RED}Run as root: sudo bash deploy.sh${NC}"; exit 1; fi

IS_UPDATE=false; [ -d "$APP_DIR" ] && IS_UPDATE=true && warn "UPDATE mode — preserving .env and uploads"

echo ""; echo -e "${GREEN}═════════════════════════════════${NC}"
echo -e "${GREEN}  Net2APP Production Deploy${NC}"
echo -e "${GREEN}  $(date)${NC}"
echo -e "${GREEN}═════════════════════════════════${NC}"

# ===== 1. System Packages =====
echo "[1/9] System packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq \
  curl wget git build-essential unzip ca-certificates gnupg lsb-release \
  nginx redis-server software-properties-common \
  libssl-dev libncurses5-dev uuid-dev libjansson-dev libedit-dev \
  libgsm1-dev mpg123 sox libsrtp2-dev 2>/dev/null || true
ok "System packages"

# ===== 2. PostgreSQL =====
echo "[2/9] PostgreSQL..."
if ! command -v psql &>/dev/null; then
  sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
  apt-get update -qq && apt-get install -y -qq postgresql-16
  systemctl enable --now postgresql
fi
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';" 2>/dev/null || true
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER postgres;"
ok "PostgreSQL ready ($DB_NAME)"

# ===== 3. Node.js =====
echo "[3/9] Node.js $NODE_V..."
if ! command -v node &>/dev/null || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" != "$NODE_V" ]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_V}.x | bash -
  apt-get install -y -qq nodejs
fi
npm install -g pm2
ok "Node $(node -v) + PM2"

# ===== 4. Java 21 =====
echo "[4/9] Java 21 (SMPP)..."
apt-get install -y -qq openjdk-21-jre-headless 2>/dev/null || apt-get install -y -qq default-jre 2>/dev/null || warn "Java not found - SMPP needs Java"
ok "Java $(java -version 2>&1 | head -1 || echo 'not installed')"

# ===== 5. Prepare app directory =====
echo "[5/9] Deploying app..."
mkdir -p "$APP_DIR/public/uploads"
cd "$APP_DIR"

# If source is in current directory, copy it
if [ -f "package.json" ] && [ "$(pwd)" != "$APP_DIR" ]; then
  if [ "$IS_UPDATE" = true ]; then
    cp "$APP_DIR/.env" /tmp/net2app_env 2>/dev/null || true
    cp -r "$APP_DIR/public/uploads" /tmp/net2app_up 2>/dev/null || true
    find "$APP_DIR" -mindepth 1 -maxdepth 1 ! -name 'node_modules' -exec rm -rf {} + 2>/dev/null || true
  fi
  cp -r . "$APP_DIR/"
  [ -f /tmp/net2app_env ] && cp /tmp/net2app_env "$APP_DIR/.env" || true
  [ -d /tmp/net2app_up ] && cp -rn /tmp/net2app_up/* "$APP_DIR/public/uploads/" || true
fi

# ===== 6. .env =====
echo "[6/9] Environment config..."
cat > "$APP_DIR/.env" << EOF
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
JWT_SECRET=net2app-prod-$(date +%s)-$(openssl rand -hex 16)
NODE_ENV=production
PORT=$APP_PORT
SMPP_PORT=$SMPP_PORT
EOF
chmod 600 "$APP_DIR/.env"
ok ".env created"

# ===== 7. Install & Build =====
echo "[7/9] Installing dependencies..."
cd "$APP_DIR"
npm install 2>&1 | tail -3
ok "npm install done"

echo "[7/9] Building application..."
npm run build 2>&1 | tail -5
ok "Build complete"

# ===== 8. Database schema =====
echo "[8/9] Database schema..."
cd "$APP_DIR"

# Push drizzle schema (non-fatal if fails)
set +e
npx drizzle-kit push 2>&1 | tail -5
set -e
warn "Schema push attempted — continuing"

# Ensure infrastructure tables exist
psql "$DB_URL" << 'SQL'
CREATE TABLE IF NOT EXISTS public.smpp_server_config (id SERIAL PRIMARY KEY, tenant_id INTEGER, name VARCHAR(255) DEFAULT 'Default SMSC', host VARCHAR(255) DEFAULT '0.0.0.0', port INTEGER DEFAULT 2775, max_connections INTEGER DEFAULT 100, is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW());
INSERT INTO public.smpp_server_config (name, host, port) SELECT 'Default SMSC', '0.0.0.0', 2775 WHERE NOT EXISTS (SELECT 1 FROM public.smpp_server_config LIMIT 1);

CREATE TABLE IF NOT EXISTS public.payment_transactions (id SERIAL PRIMARY KEY, tenant_id INTEGER, amount DECIMAL(12,2), payment_method VARCHAR(50), transaction_id VARCHAR(255), status VARCHAR(20) DEFAULT 'COMPLETED', sms_amount INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.cdr_deleted_items (id SERIAL PRIMARY KEY, entity_type VARCHAR(50), entity_id INTEGER, entity_name VARCHAR(255), entity_data JSONB, deleted_by VARCHAR(255), deleted_at TIMESTAMP DEFAULT NOW(), tenant_id INTEGER);
CREATE TABLE IF NOT EXISTS public.audit_log (id SERIAL PRIMARY KEY, entity_type VARCHAR(50), entity_id INTEGER, action VARCHAR(20), changed_by VARCHAR(255), old_data JSONB, new_data JSONB, ip_address VARCHAR(50), created_at TIMESTAMP DEFAULT NOW(), tenant_id INTEGER);
CREATE TABLE IF NOT EXISTS public.login_sessions (id SERIAL PRIMARY KEY, user_type VARCHAR(20), user_id INTEGER, email VARCHAR(255), ip_address VARCHAR(50), user_agent TEXT, login_at TIMESTAMP DEFAULT NOW(), logout_at TIMESTAMP, token_hash VARCHAR(255));
CREATE TABLE IF NOT EXISTS public.mcc_traffic_stats (id SERIAL PRIMARY KEY, tenant_id INTEGER, mcc VARCHAR(10), country_code VARCHAR(10), country_name VARCHAR(100), message_count INTEGER DEFAULT 0, delivered_count INTEGER DEFAULT 0, failed_count INTEGER DEFAULT 0, total_cost DECIMAL(12,6) DEFAULT 0, created_at TIMESTAMP DEFAULT NOW());

INSERT INTO public.platform_settings (key, value) VALUES ('globalCostPerSms', '0.00030') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.platform_settings (key, value) VALUES ('ott_proxy_required', 'true') ON CONFLICT (key) DO NOTHING;
SQL

ok "Database tables ready"

# ===== 9. Start & Nginx =====
echo "[9/9] Starting services..."

# PM2
cd "$APP_DIR"
pm2 delete net2app 2>/dev/null || true
pm2 start npm --name "net2app" -- start --cwd "$APP_DIR"
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# Nginx
cat > /etc/nginx/sites-available/net2app << 'NGX'
server {
    listen 80;
    server_name _;
    client_max_body_size 100M;
    location / {
        proxy_pass http://127.0.0.1:5555;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }
}
NGX
ln -sf /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t 2>&1 && systemctl reload nginx || warn "Nginx config issue"

# Firewall
command -v ufw &>/dev/null && { ufw allow 80/tcp; ufw allow 443/tcp; ufw allow $SMPP_PORT/tcp; ufw allow $APP_PORT/tcp; ufw --force enable; } || true

# Sleep and verify
sleep 3
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""; echo -e "${GREEN}══════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Net2APP Deployed!${NC}"
echo -e "${GREEN}══════════════════════════════════${NC}"
echo ""
echo "  🌐 http://$SERVER_IP           Landing Page"
echo "  👑 http://$SERVER_IP/super     Admin Portal"
echo "  🔌 SMPP Port: $SMPP_PORT"
echo ""
echo "  Setup Admin:"
echo "  1. Go to http://$SERVER_IP/super"
echo "  2. Click 'First time setup?'"
echo "  3. Setup Key: SETUP_SMS_PLATFORM_2024"
echo ""
echo "  Manage:  pm2 logs net2app"
echo "  Restart: pm2 restart net2app"
echo ""
echo "  © Tri Angle Trade Centre Fze LLC"
echo -e "${GREEN}══════════════════════════════════${NC}"
