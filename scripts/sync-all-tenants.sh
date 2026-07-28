#!/usr/bin/env bash
# sync-all-tenants.sh — Push all tenants from Origin to remote servers
set -e

SYNC_SECRET="net2app-internal-sync-2024"
ORIGIN="149.56.22.232"
REMOTES=("15.235.35.125:Canada2" "54.37.252.5:France" "145.239.1.7:Germany" "146.59.47.22:Poland")
PASSWORD="Telco1988"

echo "=== Step 1: Fetch all active tenants from Origin ==="
TENANTS=$(sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no ubuntu@$ORIGIN \
  "export PGPASSWORD=postgres && psql -h 127.0.0.1 -U postgres -d app_db -t -A -F'|' \
  -c \"SELECT company_name, email, phone, password_hash, schema_name, smpp_server_ip, server_location, cost_per_sms, sms_limit FROM tenants WHERE is_active = true ORDER BY id;\" 2>&1")

TOTAL=$(echo "$TENANTS" | wc -l)
echo "Found $TOTAL active tenants on Origin"

for REMOTE in "${REMOTES[@]}"; do
  IP="${REMOTE%%:*}"
  NAME="${REMOTE##*:}"
  
  echo ""
  echo "=== Syncing to $NAME ($IP) ==="
  
  # Check if remote server is reachable
  HTTP=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://$IP:5556/" 2>/dev/null || echo "000")
  if [ "$HTTP" != "200" ]; then
    echo "  ⚠️  Server not reachable (HTTP $HTTP) — skipping"
    continue
  fi
  
  # Get existing tenant emails on remote
  EXISTING=$(sshpass -p "$PASSWORD" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ubuntu@$IP \
    "export PGPASSWORD=postgres && psql -h 127.0.0.1 -U postgres -d app_db -t -A -c \"SELECT email FROM tenants WHERE is_active = true;\" 2>&1" || echo "")
  
  SYNCED=0
  SKIPPED=0
  FAILED=0
  
  while IFS='|' read -r companyName email phone passwordHash schemaName smppServerIp serverLocation costPerSms smsLimit; do
    [ -z "$email" ] && continue
    
    # Skip if already exists
    if echo "$EXISTING" | grep -qF "$email"; then
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
    
    # Push via internal sync API
    RESPONSE=$(curl -s -X POST "http://$IP:5556/api/internal/sync-tenant" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $SYNC_SECRET" \
      -d "{\"companyName\":\"$companyName\",\"email\":\"$email\",\"phone\":\"$phone\",\"passwordHash\":\"$passwordHash\",\"schemaName\":\"$schemaName\",\"smppServerIp\":\"$smppServerIp\",\"serverLocation\":\"$serverLocation\",\"costPerSms\":\"$costPerSms\",\"smsLimit\":${smsLimit:-100}}" \
      --max-time 60 2>&1)
    
    if echo "$RESPONSE" | grep -q '"synced":true'; then
      SYNCED=$((SYNCED + 1))
      echo "  ✅ $companyName ($email)"
    else
      FAILED=$((FAILED + 1))
      echo "  ❌ $companyName ($email) — $RESPONSE"
    fi
  done <<< "$TENANTS"
  
  echo "  ---"
  echo "  $NAME: $SYNCED synced, $SKIPPED skipped, $FAILED failed"
done

echo ""
echo "=== Done ==="
