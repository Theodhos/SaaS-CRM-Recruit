#!/bin/sh
# Logical backup of the CRM database, with integrity check, checksum, retention and a Prometheus metric.
#
# Works against ANY PostgreSQL reachable through the standard libpq environment (PGHOST, PGUSER, PGPASSWORD,
# PGDATABASE ...) or a DATABASE_URL. POSIX sh, so it runs inside the stock postgres:16-alpine image.
#
#   BACKUP_DIR=/backups BACKUP_RETENTION_DAYS=14 ./backup-postgres.sh
#
# A logical dump is the portable, restorable-anywhere layer. It is NOT point-in-time recovery: for that use
# the managed provider's PITR / WAL archiving (docs/operations/backup-and-recovery.md). A backup only counts
# once a restore has been rehearsed — see verify-restore.sh.
set -eu

: "${BACKUP_DIR:?set BACKUP_DIR}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
SCHEMA="${PGSCHEMA:-recruitment_crm}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/crm-$STAMP.dump"

mkdir -p "$BACKUP_DIR"
started="$(date +%s)"

echo "[backup] dumping schema '$SCHEMA' -> $OUT"
# custom format: compressed, parallel-restorable, selective restore. Written under a temp name first so a
# crash mid-dump can never leave something that looks like a valid backup.
if [ -n "${DATABASE_URL:-}" ]; then
  # Prisma's `?schema=` / `connection_limit` parameters are not libpq options; strip the query string.
  pg_dump --format=custom --compress=6 --no-owner --no-privileges --schema="$SCHEMA" \
          --file="$OUT.partial" "${DATABASE_URL%%\?*}"
else
  pg_dump --format=custom --compress=6 --no-owner --no-privileges --schema="$SCHEMA" \
          --file="$OUT.partial"
fi

# The archive must be readable end to end before we call it a backup.
pg_restore --list "$OUT.partial" > /dev/null
mv "$OUT.partial" "$OUT"
( cd "$BACKUP_DIR" && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256" )

# Retention: drop dumps (and their checksums) older than N days, but never the newest one.
find "$BACKUP_DIR" -maxdepth 1 -name 'crm-*.dump' -mtime +"$RETENTION_DAYS" | while read -r old; do
  [ "$old" = "$OUT" ] && continue
  rm -f "$old" "$old.sha256"
  echo "[backup] pruned $old"
done

finished="$(date +%s)"
size="$(wc -c < "$OUT" | tr -d ' ')"

# Prometheus textfile-collector metric (node-exporter reads *.prom from this directory).
tmp="$BACKUP_DIR/.crm_backup.prom.$$"
{
  echo "# HELP crm_backup_last_success_timestamp_seconds Unix time of the last successful database backup."
  echo "# TYPE crm_backup_last_success_timestamp_seconds gauge"
  echo "crm_backup_last_success_timestamp_seconds $finished"
  echo "# HELP crm_backup_duration_seconds Duration of the last backup."
  echo "# TYPE crm_backup_duration_seconds gauge"
  echo "crm_backup_duration_seconds $((finished - started))"
  echo "# HELP crm_backup_size_bytes Size of the last backup."
  echo "# TYPE crm_backup_size_bytes gauge"
  echo "crm_backup_size_bytes $size"
} > "$tmp"
mv "$tmp" "$BACKUP_DIR/crm_backup.prom"

echo "[backup] ok: $OUT ($size bytes, $((finished - started))s)"
