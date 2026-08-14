#!/usr/bin/env bash
# =============================================================================
# migrate-schemas-to-assigned-servers.sh  (FINAL)
# Migrates tenant schemas from the dev box (15.235.35.125) to the production
# server each tenant is ASSIGNED to (tenants.smpp_server_ip).
# Idempotent: skips tenants whose schema already exists on the target.
# =============================================================================
set -uo pipefail

DB="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/app_db}"
SSH_USER="ubuntu"
SSH_PASS="Telco1988"
BACKUP_DIR="/tmp/tenant-migration-backup"
LOG="/tmp/net2app-tenant-migration.log"

export SSHPASS="$SSH_PASS"
mkdir -p "$BACKUP_DIR"

ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "$(ts) | $1" | tee -a "$LOG"; }

TMP_TENANTS=$(mktemp)
psql "$DB" -tA -F'|' \
  -c "SELECT id, email, schema_name, COALESCE(smpp_server_ip,''), COALESCE(server_location,'') FROM tenants WHERE schema_name LIKE 'tenant_%' ORDER BY id" \
  2>/dev/null > "$TMP_TENANTS"

while IFS='|' read -r id email schema assignedIp currentLoc; do
  [ -z "$id" ] && continue
  [ -z "$schema" ] && continue
  [ -z "$assignedIp" ] && continue
  [ "$assignedIp" = "0.0.0.0" ] && continue

  # Skip tenants already served locally
  case "$assignedIp" in
    15.235.35.125) continue ;;
    146.59.47.22|66.70.176.241) # dead/decommissioned servers -> Origin
      log "  ↪ #$id $schema was on dead server $assignedIp — remapping to Origin (149.56.22.232)"
      assignedIp="149.56.22.232"; TARGET_LOC="canada-origin" ;;
  esac

  # Map assigned IP -> location label
  case "$assignedIp" in
    149.56.22.232) TARGET_LOC="canada-origin" ;;
    54.37.252.5)   TARGET_LOC="france" ;;
    145.239.1.7)   TARGET_LOC="germany" ;;
    139.99.148.65)  TARGET_LOC="sydney" ;;
    139.99.148.177) TARGET_LOC="sydney-2" ;;
    *) log "  ⏭️  #$id $schema -> unknown IP $assignedIp — skipping"; continue ;;
  esac

  # Skip if already migrated: target schema exists AND has tables.
  TGT_CNT=$(timeout 30 sshpass -e ssh -n -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SSH_USER@$assignedIp" \
    "export PGPASSWORD=postgres; psql -h 127.0.0.1 -U postgres -d app_db -tA -c 'SELECT COUNT(*) FROM pg_tables WHERE schemaname = '\"'\"'$schema'\"'\"'' 2>&1" 2>/dev/null | tr -d '[:space:]')
  if [ -n "$TGT_CNT" ] && [[ "$TGT_CNT" =~ ^[0-9]+$ ]] && [ "$TGT_CNT" -gt 0 ]; then
    log "  ⏭️  #$id $schema already on $TARGET_LOC ($TGT_CNT tables)"
    continue
  fi

  log "── Migrating #$id $email → $TARGET_LOC ($assignedIp) ──"

  # 1. Dump (keep first backup; refresh only if missing)
  if [ ! -f "$BACKUP_DIR/$schema.sql" ]; then
    pg_dump "$DB" -n "$schema" --no-owner --no-privileges -f "$BACKUP_DIR/$schema.sql" 2>/dev/null
  fi
  if [ ! -s "$BACKUP_DIR/$schema.sql" ]; then
    log "  ❌ #$id dump missing/empty — skipping"
    continue
  fi

  # 2. Restore on target — drop first (separate SSH call), then stream dump.
  #    ON_ERROR_STOP=0: a few dumps carry benign errors; continue past them.
  DUMP_SIZE=$(wc -c < "$BACKUP_DIR/$schema.sql")
  log "  Restoring $schema ($DUMP_SIZE bytes) on $assignedIp..."
  timeout 30 sshpass -e ssh -n -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SSH_USER@$assignedIp" \
    "export PGPASSWORD=postgres; psql -h 127.0.0.1 -U postgres -d app_db -c 'DROP SCHEMA IF EXISTS \"$schema\" CASCADE' >/dev/null 2>&1" 2>/dev/null
  RESTORE_OUT=$(timeout 120 sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SSH_USER@$assignedIp" \
    "export PGPASSWORD=postgres; psql -h 127.0.0.1 -U postgres -d app_db -v ON_ERROR_STOP=0 -q -f - 2>&1" \
    < "$BACKUP_DIR/$schema.sql" 2>&1)

  # 3. Verify data landed (target must now have tables)
  TGT_TABLES=$(timeout 30 sshpass -e ssh -n -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SSH_USER@$assignedIp" \
    "export PGPASSWORD=postgres; psql -h 127.0.0.1 -U postgres -d app_db -tA -c 'SELECT COUNT(*) FROM pg_tables WHERE schemaname = '\"'\"'$schema'\"'\"'' 2>&1" 2>/dev/null | tr -d '[:space:]')
  ORIG_TABLES=$(psql "$DB" -tA -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname='$schema'" 2>/dev/null | tr -d '[:space:]')
  log "  Verify: dev tables=$ORIG_TABLES  target tables=$TGT_TABLES"
  if [ -z "$TGT_TABLES" ] || [[ ! "$TGT_TABLES" =~ ^[0-9]+$ ]] || [ "$TGT_TABLES" = "0" ]; then
    log "  ❌ #$id restore FAILED on $assignedIp: $(echo "$RESTORE_OUT" | grep -iE 'ERROR|FATAL' | head -2 | tr '\n' ' ')"
    continue
  fi

  # 4. Re-confirm assignment on both boxes (idempotent)
  psql "$DB" -qc "UPDATE tenants SET smpp_server_ip='$assignedIp', server_location='$TARGET_LOC', updated_at=NOW() WHERE id=$id" 2>/dev/null
  timeout 30 sshpass -e ssh -n -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$SSH_USER@$assignedIp" \
    "export PGPASSWORD=postgres; psql -h 127.0.0.1 -U postgres -d app_db -qc \"UPDATE tenants SET smpp_server_ip='$assignedIp', server_location='$TARGET_LOC', updated_at=NOW() WHERE email='$email'\" 2>&1" 2>/dev/null

  log "  ✅ #$id $email → $TARGET_LOC ($assignedIp) [tables=$TGT_TABLES]"
done < "$TMP_TENANTS"
rm -f "$TMP_TENANTS"

log "Migration pass complete."
