#!/bin/sh
# Restore a dump produced by backup-postgres.sh into a target database.
#
#   ./restore-postgres.sh /backups/crm-20260925T020000Z.dump postgresql://user:pass@host:5432/crm_restore
#
# Safety: restoring OVERWRITES objects in the target. The script refuses to touch a database whose name does
# not end in `_restore` / `_scratch` / `_verify` unless you pass --force-overwrite explicitly. To recover
# production, restore into a NEW database first, verify it, then switch the application over (or rename) —
# see docs/operations/backup-and-recovery.md.
set -eu

DUMP="${1:?usage: restore-postgres.sh <dump-file> <target-database-url> [--force-overwrite]}"
TARGET="${2:?usage: restore-postgres.sh <dump-file> <target-database-url> [--force-overwrite]}"
FORCE="${3:-}"
JOBS="${RESTORE_JOBS:-4}"

[ -f "$DUMP" ] || { echo "no such dump: $DUMP" >&2; exit 2; }

# Verify integrity before touching anything.
if [ -f "$DUMP.sha256" ]; then
  ( cd "$(dirname "$DUMP")" && sha256sum -c "$(basename "$DUMP").sha256" ) || { echo "checksum mismatch — refusing to restore" >&2; exit 3; }
fi
pg_restore --list "$DUMP" > /dev/null || { echo "dump is unreadable" >&2; exit 3; }

DB="${TARGET##*/}"; DB="${DB%%\?*}"
case "$DB" in
  *_restore|*_scratch|*_verify) ;;
  *) [ "$FORCE" = "--force-overwrite" ] || { echo "target database '$DB' does not look like a restore target; pass --force-overwrite to override" >&2; exit 4; } ;;
esac

TARGET_URL="${TARGET%%\?*}"
started="$(date +%s)"
echo "[restore] $DUMP -> $DB (jobs=$JOBS)"
pg_restore --no-owner --no-privileges --clean --if-exists --exit-on-error --jobs="$JOBS" --dbname="$TARGET_URL" "$DUMP"
echo "[restore] done in $(( $(date +%s) - started ))s"
