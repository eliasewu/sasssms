#!/usr/bin/env bash
# =============================================================================
# migrate-tenants-off-dev.sh
# -----------------------------------------------------------------------------
# Migrates tenants OFF the development server (15.235.35.125) onto production
# boxes by:
#   1. Dumping the tenant schema from the origin DB (local pg_dump)
#   2. Dropping the empty shell schema on the target production box
#   3. Restoring the full schema (clients, suppliers, rates, routing, messages)
#   4. Updating tenants.smpp_server_ip / server_location on BOTH the origin
#      and the target box so the tenant's SMPP clients point at production
#
# Usage:  bash scripts/migrate-tenants-off-dev.sh [--pilot] [--ids 1,60]
#   --pilot   migrate only tenant ids 75 (empty) and 1 (has data) as a smoke test
#   --ids N   migrate only the given comma-separated tenant ids
#
# Safe:  every schema is dumped to /root/tenant-migration-backup first; the
#        script aborts a tenant if the restore fails or verify counts mismatch.
# =============================================================================
set -uo pipefail

DB="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/app_db}"
DEV_IP="15.235.35.125"
FRANCE_IP="54.37.252.5"
GERMANY_IP="145.239.1.7"
SSH_USER="ubuntu"
SSH_PASS="Telco1988"
BACKUP_DIR="/root/tenant-migration-backup"
LOG="/var/log/net2app-tenant-migration.log"

export SSHPASS="$SSH_PASS"
mkdir -p "$BACKUP_DIR"

ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "$(ts) | $1" | tee -a "$LOG"; }

# ── Select tenants to migrate ──
if [ "${1:-}" = "--pilot" ]; then
  TENANT_IDS="75,1"
  log "PILOT MODE — migrating tenants 75 (empty) + 1 (has data)"
elif [ -n "${2:-}" ] && [ "${1:-}" = "--ids" ]; then
  TENANT_IDS="$2"
  log "MIGRATING selected ids: $TENANT_IDS"
else
  TENANT_IDS=$(psql "$DB" -tA -c "SELECT string_agg(id::text, ',') FROM tenants WHERE smpp_server_ip = '$DEV_IP'" 2>/dev/null)
  log "MIGRATING all tenants on dev server: $TENANT_IDS"
fi

# ── Fetch tenant rows into a temp file (a pipe would be consumed by the
#    ssh commands inside the loop, silently skipping tenants) ──
TMP_TENANTS=$(mktemp)
psql "$DB" -tA -F'|' -c "SELECT id, email, schema_name, server_location FROM tenants WHERE smpp_server_ip = '$DEV_IP' ORDER BY id" 2>/dev/null > "$TMP_TENANTS"

while IFS='|' read -r id email schema currentLoc; do
    [ -z "$id" ] && continue
    if [ -n "${TENANT_IDS:-}" ]; then
      case ",$TENANT_IDS," in *",$id,"*) ;; *) continue;; esac
    fi

    # Round-robin target: alternate France / Germany by tenant id
    if [ $((id % 2)) -eq 0 ]; then TARGET_IP="$GERMANY_IP"; TARGET_LOC="germany"; else TARGET_IP="$FRANCE_IP"; TARGET_LOC="france"; fi

    log "── Migrating tenant #$id ($email) → $TARGET_LOC ($TARGET_IP) ──"

    # 1. Fresh dump from origin
    if [ ! -f "$BACKUP_DIR/$schema.sql" ]; then
      pg_dump "$DB" -n "$schema" --no-owner --no-privileges -f "$BACKUP_DIR/$schema.sql" 2>/dev/null
    fi
    if [ ! -s "$BACKUP_DIR/$schema.sql" ]; then
      log "  ❌ #$id dump missing/empty — skipping"
      continue
    fi

    # 2. Drop empty shell + restore full schema on target
    DUMP_SIZE=$(wc -c < "$BACKUP_DIR/$schema.sql")
    log "  Restoring $schema ($DUMP_SIZE bytes) on $TARGET_IP..."
    # The dump contains its own CREATE SCHEMA, so only drop the empty shell
    # (left by replication) and feed the dump — psql recreates the schema.
    RESTORE_OUT=$(timeout 120 sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SSH_USER@$TARGET_IP" \
      "export PGPASSWORD=postgres; psql -h 127.0.0.1 -U postgres -d app_db -c 'DROP SCHEMA IF EXISTS \"$schema\" CASCADE' >/dev/null 2>&1; psql -h 127.0.0.1 -U postgres -d app_db -v ON_ERROR_STOP=1 -q -f - 2>&1" \
      < "$BACKUP_DIR/$schema.sql" 2>&1)
    if echo "$RESTORE_OUT" | grep -qiE 'ERROR|FATAL'; then
      log "  ❌ #$id restore FAILED on $TARGET_IP: $(echo "$RESTORE_OUT" | grep -iE 'ERROR|FATAL' | head -2 | tr '\n' ' ')"
      continue
    fi

    # 3. Verify data landed (clients + suppliers must match origin)
    ORIG_CLIENTS=$(psql "$DB" -tA -c "SELECT COUNT(*) FROM \"$schema\".clients" 2>/dev/null)
    ORIG_SUPPS=$(psql "$DB" -tA -c "SELECT COUNT(*) FROM \"$schema\".suppliers" 2>/dev/null)
    TGT_CLIENTS=$(timeout 30 sshpass -e ssh -n -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SSH_USER@$TARGET_IP" \
      "export PGPASSWORD=postgres; psql -h 127.0.0.1 -U postgres -d app_db -tA -c 'SELECT COUNT(*) FROM \"$schema\".clients' 2>&1" 2>/dev/null | tr -d '[:space:]')
    TGT_SUPPS=$(timeout 30 sshpass -e ssh -n -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SSH_USER@$TARGET_IP" \
      "export PGPASSWORD=postgres; psql -h 127.0.0.1 -U postgres -d app_db -tA -c 'SELECT COUNT(*) FROM \"$schema\".suppliers' 2>&1" 2>/dev/null | tr -d '[:space:]')
    log "  Verify: origin clients/suppliers=$ORIG_CLIENTS/$ORIG_SUPPS  target=$TGT_CLIENTS/$TGT_SUPPS"
    if [ "${TGT_CLIENTS:-x}" != "${ORIG_CLIENTS:-y}" ] || [ "${TGT_SUPPS:-x}" != "${ORIG_SUPPS:-y}" ]; then
      log "  ❌ #$id count MISMATCH — leaving assignment unchanged (schema restored, verify manually)"
      continue
    fi

    # 4. Point the tenant at production on BOTH boxes
    psql "$DB" -qc "UPDATE tenants SET smpp_server_ip = '$TARGET_IP', server_location = '$TARGET_LOC', updated_at = NOW() WHERE id = $id" 2>&1
    timeout 30 sshpass -e ssh -n -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SSH_USER@$TARGET_IP" \
      "export PGPASSWORD=postgres; psql -h 127.0.0.1 -U postgres -d app_db -qc \"UPDATE tenants SET smpp_server_ip = '$TARGET_IP', server_location = '$TARGET_LOC', updated_at = NOW() WHERE email = '$email'\" 2>&1" 2>/dev/null

    log "  ✅ #$id $email → $TARGET_LOC ($TARGET_IP) [clients=$TGT_CLIENTS suppliers=$TGT_SUPPS]"
  done < "$TMP_TENANTS"
rm -f "$TMP_TENANTS"

log "Migration pass complete."
