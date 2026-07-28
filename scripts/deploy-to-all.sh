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

# All known server IPs with credentials
declare -A SERVERS
SERVERS=(
  ["149.56.22.232"]="ubuntu:Telco1988"   # Canada Origin (Cloudflare)
  ["15.235.35.125"]="ubuntu:Telco1988"   # Canada
  ["54.37.252.5"]="ubuntu:Telco1988"     # France
  ["145.239.1.7"]="ubuntu:Telco1988"     # Germany
  ["146.59.47.22"]="ubuntu:Telco1988"    # Poland
)

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

for IP in "${!SERVERS[@]}"; do
  # Skip self
  if [ "$IP" = "$SELF_IP" ]; then
    echo "  ⏭️  $IP (self — skipping)"
    continue
  fi

  IFS=':' read -r USER PASS <<< "${SERVERS[$IP]}"
  export SSHPASS="$PASS"

  echo -n "  📤 $IP... "

  # Sync source (exclude heavy dirs)
  if sshpass -e rsync -avz --delete \
    --exclude node_modules --exclude .next --exclude .git --exclude .server-creds \
    -e 'ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10' \
    "$APP_DIR/" "$USER@$IP:/opt/net2app/" 2>&1 | tail -1 | grep -q "speedup"; then
    echo -n "synced, "

    # Rebuild on remote
    sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$USER@$IP" \
      "cd /opt/net2app && rm -rf .next && npm run build 2>&1 | tail -1" 2>/dev/null

    # Restart PM2
    sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$USER@$IP" \
      "sudo pm2 restart net2app 2>/dev/null || sudo pm2 start npm --name net2app -- run start" 2>/dev/null

    echo "restarted ✅"
  else
    echo "FAILED ❌"
    FAILED_SERVERS="$FAILED_SERVERS $IP"
  fi
done

# ── Step 4: Verify ──
echo ""
echo "🔍 [4/4] Verifying..."

sleep 8

ALL_OK=true
for IP in "${!SERVERS[@]}"; do
  if [ "$IP" = "$SELF_IP" ]; then
    echo -n "  $IP (local): "
    curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:5556" 2>/dev/null
    echo ""
  else
    echo -n "  $IP: "
    curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://$IP:5556" 2>/dev/null || { echo "DOWN"; ALL_OK=false; }
    echo ""
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
