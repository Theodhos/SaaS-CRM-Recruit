#!/bin/sh
# Proves a backup is restorable: restores the newest dump into a throw-away database, checks it, measures how
# long it took (your real RTO for a logical restore), and drops the database again. Schedule it (weekly) —
# a backup that has never been restored is a hope, not a backup.
#
#   PGHOST=... PGUSER=... PGPASSWORD=... BACKUP_DIR=/backups ./verify-restore.sh
#
# Needs a role that may CREATE DATABASE on the server hosting the scratch copy.
set -eu

: "${BACKUP_DIR:?set BACKUP_DIR}"
SCHEMA="${PGSCHEMA:-recruitment_crm}"
SCRATCH="crm_verify_$(date -u +%Y%m%d%H%M%S)_verify"
ADMIN_DB="${PGADMINDB:-postgres}"
DIR="$(dirname "$0")"

DUMP="$(ls -1t "$BACKUP_DIR"/crm-*.dump 2>/dev/null | head -n 1 || true)"
[ -n "$DUMP" ] || { echo "[verify] no backups found in $BACKUP_DIR" >&2; exit 2; }
echo "[verify] newest backup: $DUMP ($(date -u -r "$DUMP" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo unknown))"

cleanup() { psql -d "$ADMIN_DB" -v ON_ERROR_STOP=1 -qc "DROP DATABASE IF EXISTS \"$SCRATCH\"" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql -d "$ADMIN_DB" -v ON_ERROR_STOP=1 -qc "CREATE DATABASE \"$SCRATCH\""
started="$(date +%s)"
# PGDATABASE must be unset for the URL form; build the URL from the libpq environment.
"$DIR/restore-postgres.sh" "$DUMP" "postgresql://${PGUSER:-postgres}:${PGPASSWORD:-}@${PGHOST:-localhost}:${PGPORT:-5432}/$SCRATCH"
restore_seconds=$(( $(date +%s) - started ))

q() { psql -d "$SCRATCH" -At -v ON_ERROR_STOP=1 -c "$1"; }
fail=0
check() { # description, actual, condition (sh test on $actual)
  if eval "[ $2 $3 ]"; then echo "  ok   $1 ($2)"; else echo "  FAIL $1 (got $2)"; fail=1; fi
}

echo "[verify] sanity checks on the restored copy"
check "tables restored"              "$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema='$SCHEMA'")" "-ge 30"
check "migrations recorded"          "$(q "SELECT count(*) FROM \"$SCHEMA\".\"_prisma_migrations\"")" "-ge 1"
check "organisations present"        "$(q "SELECT count(*) FROM \"$SCHEMA\".organisations")" "-ge 1"
check "users present"                "$(q "SELECT count(*) FROM \"$SCHEMA\".users")" "-ge 1"
check "no invalid constraints"       "$(q "SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='$SCHEMA' AND NOT c.convalidated")" "-eq 0"
check "no invalid indexes"           "$(q "SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='$SCHEMA' AND NOT i.indisvalid")" "-eq 0"
check "no orphan applications"       "$(q "SELECT count(*) FROM \"$SCHEMA\".applications a LEFT JOIN \"$SCHEMA\".candidates c ON c.id=a.\"candidateId\" WHERE c.id IS NULL")" "-eq 0"
echo "[verify] restore took ${restore_seconds}s (this is your measured RTO for a logical restore of this dataset)"

{
  echo "# HELP crm_backup_restore_verify_success 1 if the last restore rehearsal passed."
  echo "# TYPE crm_backup_restore_verify_success gauge"
  echo "crm_backup_restore_verify_success $([ "$fail" -eq 0 ] && echo 1 || echo 0)"
  echo "# HELP crm_backup_restore_duration_seconds Duration of the last restore rehearsal."
  echo "# TYPE crm_backup_restore_duration_seconds gauge"
  echo "crm_backup_restore_duration_seconds $restore_seconds"
} > "$BACKUP_DIR/.crm_restore.prom.$$" && mv "$BACKUP_DIR/.crm_restore.prom.$$" "$BACKUP_DIR/crm_restore.prom"

[ "$fail" -eq 0 ] && echo "[verify] PASSED" || { echo "[verify] FAILED"; exit 1; }
