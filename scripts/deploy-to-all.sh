#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  Net2APP — Deploy to ALL Servers
#  Builds + deploys locally, then syncs to all remote servers
# ═══════════════════════════════════════════════════════════════════
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ok() { echo -e "  ${GREEN}✅ $1${NC}"; }
warn() { echo -e "  ${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "  ${RED}❌ $1${NC}"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
cd "$APP_DIR"

# All known server IPs (SSH key auth preferred, password as fallback)
SERVERS=(
  "15.235.35.125"   # Canada — Toronto (dev box)
  "149.56.22.232"   # Canada — Toronto (Origin)
  "54.37.252.5"     # France — Paris
  "145.239.1.7"     # Germany — Frankfurt
  "139.99.148.65"   # Australia — Sydney
)
SSH_USER="ubuntu"
SSH_PASS="Telco1988"
DEPLOY_PORT="5556"

SELF_IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || echo "127.0.0.1")
echo "🌍 Self IP: $SELF_IP"
echo ""

# ── Step 1: Build locally ──
echo "📦 [1/4] Building application..."
npm run build 2>&1 | tail -5
ok "Build complete"

# ── Step 2: Deploy locally ──
echo ""
echo "🚀 [2/4] Deploying locally..."
sudo bash deploy.sh --quick 2>&1 | tail -5
ok "Local deploy complete"

# ── Step 3: Sync to all remote servers ──
echo ""
echo "📡 [3/4] Syncing to all remote servers..."

FAILED_SERVERS=""

# Helper: try SSH key first, fall back to sshpass
ssh_do() {
  local ip=$1; shift
  ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes "$SSH_USER@$ip" "$@" 2>/dev/null || \
    SSHPASS="$SSH_PASS" sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SSH_USER@$ip" "$@" 2>/dev/null
}

rsync_do() {
  local ip=$1
  rsync -avz --delete \
    --exclude node_modules --exclude .next --exclude .git --exclude .server-creds \
    -e 'ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes' \
    "$APP_DIR/" "$SSH_USER@$ip:/opt/net2app/" 2>/dev/null || \
  SSHPASS="$SSH_PASS" sshpass -e rsync -avz --delete \
    --exclude node_modules --exclude .next --exclude .git --exclude .server-creds \
    -e 'ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10' \
    "$APP_DIR/" "$SSH_USER@$ip:/opt/net2app/" 2>/dev/null
}

for IP in "${SERVERS[@]}"; do
  # Skip self
  if [ "$IP" = "$SELF_IP" ]; then
    echo "  ⏭️  $IP (self — skipping)"
    continue
  fi

  echo -n "  📤 $IP... "

  # Sync source (exclude heavy dirs)
  if rsync_do "$IP" 2>&1 | tail -1 | grep -q "speedup"; then
    echo -n "synced, "

    # Install + rebuild on remote
    ssh_do "$IP" "cd /opt/net2app && npm install 2>&1 | tail -1 && rm -rf .next && npm run build 2>&1 | tail -1" 2>/dev/null

    # Ensure port 5556 in .env
    ssh_do "$IP" "grep -q 'PORT=5556' /opt/net2app/.env 2>/dev/null || echo 'PORT=5556' >> /opt/net2app/.env" 2>/dev/null

    # Kill old port 5555 if still running
    ssh_do "$IP" "sudo fuser -k 5555/tcp 2>/dev/null; true" 2>/dev/null

    # Restart PM2
    ssh_do "$IP" "pm2 delete net2app 2>/dev/null; cd /opt/net2app && pm2 start npm --name net2app -- run start && pm2 save" 2>/dev/null

    # Install watchdog
    ssh_do "$IP" "sudo cp /opt/net2app/scripts/net2app-watchdog.sh /usr/local/bin/net2app-watchdog 2>/dev/null; sudo chmod +x /usr/local/bin/net2app-watchdog 2>/dev/null; (crontab -l 2>/dev/null | grep -v net2app-watchdog; echo '*/2 * * * * /usr/local/bin/net2app-watchdog') | crontab - 2>/dev/null" 2>/dev/null

    echo "restarted ✅"
  else
    echo "FAILED ❌"
    FAILED_SERVERS="$FAILED_SERVERS $IP"
  fi
done

# ── Step 4: Verify ──
echo ""
echo "🔍 [4/4] Verifying..."

sleep 15  # Give servers more time to start up

ALL_OK=true
for IP in "${SERVERS[@]}"; do
  if [ "$IP" = "$SELF_IP" ]; then
    echo -n "  $IP (local): "
    curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:$DEPLOY_PORT" 2>/dev/null
    echo ""
  else
    echo -n "  $IP: "
    if ssh_do "$IP" "curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:$DEPLOY_PORT/" 2>/dev/null | grep -q "200"; then
      echo "200 ✅"
    else
      echo "DOWN ❌"
      ALL_OK=false
    fi
  fi
done

echo ""
echo "══════════════════════════════════════════════"
if [ "$ALL_OK" = true ] && [ -z "$FAILED_SERVERS" ]; then
  ok "Deploy complete — all servers online"
else
  if [ -n "$FAILED_SERVERS" ]; then
    warn "Sync failed for: $FAILED_SERVERS"
  fi
fi

echo "  🌐 https://net2app.com"
echo "  📊 https://net2app.com/status"
echo "══════════════════════════════════════════════"
