#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  Net2APP Server Manager — Auto-Deploy Script
#  Called by: POST /api/super/servers (deploy=true)
#  Env vars:  DEPLOY_IP, DEPLOY_USER, DEPLOY_SSH_PASS, DEPLOY_SU_PASS
#  Arg 1:     LOCATION_ID (e.g. canada, france)
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

IP="${DEPLOY_IP:-}"
SSH_USER="${DEPLOY_USER:-ubuntu}"
SSH_PASS="${DEPLOY_SSH_PASS:-}"
SU_PASS="${DEPLOY_SU_PASS:-${SSH_PASS}}"
LOCATION_ID="${1:-unknown}"
APP_DIR="/opt/net2app"
GIT_REPO="${DEPLOY_GIT_REPO:-https://github.com/eliasewu/sasssms.git}"

if [ -z "$IP" ] || [ -z "$SSH_PASS" ]; then
  echo "Usage: DEPLOY_IP=x DEPLOY_USER=x DEPLOY_SSH_PASS=x [DEPLOY_SU_PASS=x] bash $0 [LOCATION_ID]"
  exit 1
fi

log() { echo "[$(date '+%H:%M:%S')] $1"; }

ssh_cmd() {
  sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 "$SSH_USER@$IP" "$@"
}

scp_cmd() {
  sshpass -e scp -o StrictHostKeyChecking=no "$@"
}

export SSHPASS="$SSH_PASS"

log "Deploying Net2APP to $IP ($LOCATION_ID) as $SSH_USER..."

# ── 1. Check connectivity ──
log "Checking SSH connectivity..."
if ! ssh_cmd "echo CONNECTED" 2>/dev/null; then
  echo "FAILED: Cannot SSH into $IP as $SSH_USER"
  exit 1
fi
log "SSH connection OK"

# ── 2. Check/install sshpass locally ──
if ! command -v sshpass &>/dev/null; then
  log "Installing sshpass locally..."
  sudo apt-get update -qq && sudo apt-get install -y -qq sshpass 2>/dev/null || true
fi

# ── 3. Copy install.sh to remote server ──
log "Copying install script..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_SCRIPT="$SCRIPT_DIR/../install.sh"

if [ ! -f "$INSTALL_SCRIPT" ]; then
  INSTALL_SCRIPT="$SCRIPT_DIR/../../install.sh"
fi

if [ ! -f "$INSTALL_SCRIPT" ]; then
  echo "FAILED: install.sh not found"
  exit 1
fi

scp_cmd "$INSTALL_SCRIPT" "$SSH_USER@$IP:/tmp/install.sh"
log "Install script copied"

# ── 4. Run install.sh on remote server ──
log "Running installation (5-10 minutes)..."
echo "$SU_PASS" | ssh_cmd "sudo -S bash /tmp/install.sh 2>&1" 2>&1 || {
  log "install.sh had issues — attempting manual deployment..."

  # ── Manual fallback: install prerequisites and clone from git ──
  echo "$SU_PASS" | ssh_cmd "sudo -S bash -c '
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq curl git nginx redis-server postgresql postgresql-contrib build-essential 2>&1 | tail -3

    if ! command -v node; then
      curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
      apt-get install -y -qq nodejs
    fi

    npm install -g pm2 2>/dev/null || true

    sudo -u postgres psql -c \"ALTER USER postgres PASSWORD '\\''postgres'\\'';\" 2>/dev/null || true
    sudo -u postgres psql -tc \"SELECT 1 FROM pg_database WHERE datname='\\''app_db'\\''\" 2>/dev/null | grep -q 1 || \
      sudo -u postgres psql -c \"CREATE DATABASE app_db OWNER postgres;\"
  ' 2>&1"

  # Clone repo from git
  log "Cloning repository..."
  echo "$SU_PASS" | ssh_cmd "sudo -S bash -c '
    if [ -d $APP_DIR/.git ]; then
      cd $APP_DIR && git pull 2>&1
    else
      rm -rf $APP_DIR
      git clone $GIT_REPO $APP_DIR 2>&1
    fi
  ' 2>&1" || {
    log "WARNING: git clone failed — repo may be private. Using files from /tmp."
    echo "$SU_PASS" | ssh_cmd "sudo -S bash -c '
      mkdir -p $APP_DIR
      for f in install.sh package.json drizzle.config.json tsconfig.json next.config.ts postcss.config.mjs; do
        [ -f /tmp/\$f ] && cp /tmp/\$f $APP_DIR/
      done
    ' 2>&1" || true
  }

  # Setup .env and build
  echo "$SU_PASS" | ssh_cmd "sudo -S bash -c '
    cd $APP_DIR

    cat > .env << ENDENV
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
JWT_SECRET=net2app-prod-\$(date +%s)-\$(openssl rand -hex 16)
NODE_ENV=production
PORT=5556
SMPP_PORT=2775
NEXT_PUBLIC_APP_URL=https://net2app.com
ENDENV
    chmod 600 .env

    npm install 2>&1 | tail -5
    npm run build 2>&1 | tail -5 || { echo "BUILD FAILED"; HEALTHY=false; }
    npx drizzle-kit push 2>&1 | tail -3 || echo \"DB_WARNING: drizzle push had issues\"

    pm2 delete net2app 2>/dev/null || true
    pm2 start npm --name net2app -- run start
    pm2 save
  ' 2>&1"

  # Configure nginx
  echo "$SU_PASS" | ssh_cmd "sudo -S bash -c '
    mkdir -p /etc/nginx/ssl
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/net2app.key \
      -out /etc/nginx/ssl/net2app.crt \
      -subj /CN=net2app.com 2>/dev/null

    cat > /etc/nginx/sites-available/net2app << NGINXEOF
server {
    listen 80;
    server_name _;
    location / { return 301 https://\\$host\\$request_uri; }
}
server {
    listen 443 ssl http2;
    server_name _;
    ssl_certificate /etc/nginx/ssl/net2app.crt;
    ssl_certificate_key /etc/nginx/ssl/net2app.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    client_max_body_size 100M;
    location / {
        proxy_pass http://127.0.0.1:5556;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_read_timeout 300s;
    }
}
NGINXEOF

    ln -sf /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl start nginx && systemctl enable nginx
  ' 2>&1"
}

# ── 5. Verify deployment ──
log "Verifying deployment..."
sleep 10

HEALTHY=true
if ! ssh_cmd "curl -s -o /dev/null -w '%{http_code}' http://localhost:5556" 2>/dev/null | grep -q "200"; then
  log "WARNING: App port 5556 not responding with 200"
  HEALTHY=false
fi

if ! ssh_cmd "ss -tlnp 2>/dev/null | grep -q ':2775'"; then
  log "WARNING: SMPP port 2775 not listening"
  HEALTHY=false
fi

# ── 6. Print summary ──
echo ""
echo "═══════════════════════════════════════"
if [ "$HEALTHY" = true ]; then
  echo "  ✅ Net2APP deployed successfully!"
  echo "  🌐 https://$IP"
  echo "  🔌 SMPP: $IP:2775"
  echo "  📍 Location: $LOCATION_ID"
else
  echo "  ⚠️  Deployment completed with warnings"
  echo "  Check: ssh $SSH_USER@$IP 'pm2 logs net2app'"
fi
echo "═══════════════════════════════════════"
