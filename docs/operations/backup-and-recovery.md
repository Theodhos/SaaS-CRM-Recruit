# Backup and disaster recovery

> A backup is not real until a restore has been rehearsed. `verify-restore.sh` does exactly that, on a schedule, and
> exports the result as a metric that alerts when it stops passing.

## Objectives (set them; then buy the mechanism that meets them)

| | Target (starting point) | How it is met |
| --- | --- | --- |
| **RPO** (data you can lose) | <= 5 minutes | managed PostgreSQL **point-in-time recovery** (continuous WAL archiving) |
| **RTO** (time to be serving again) | <= 1 hour | restore/promote from the provider (PITR) — measured logical-restore time is below |
| Retention | 14 days PITR + 14 daily logical dumps + 3 monthly | provider setting + `BACKUP_RETENTION_DAYS` |

There are two layers, and you want both:

1. **Physical backup + PITR** — the provider's continuous backup (Supabase PITR add-on, RDS/Cloud SQL automated backups + WAL).
   Restores to any second in the retention window. This is what you reach for when someone runs a bad `DELETE` at 14:03.
2. **Logical dump** (`pg_dump`, `infrastructure/scripts/backup-postgres.sh`) — portable across providers and versions, lets you
   restore a single table or a single tenant's schema, and survives losing the provider account. Stored off the database host.

## What runs

| Component | What | Where |
| --- | --- | --- |
| `backup-postgres.sh` | custom-format dump of the `recruitment_crm` schema, integrity check (`pg_restore --list`), `sha256`, retention, Prometheus textfile metric | `db-backup` service (local-db profile) or a scheduled job / cron on any host that can reach the database |
| `restore-postgres.sh` | checksum-verified restore into a **new** database; refuses non-`*_restore/_scratch/_verify` targets without `--force-overwrite` | manual / recovery |
| `verify-restore.sh` | restores the newest dump into a throw-away database, runs sanity checks, measures the duration, drops it, writes `crm_backup_restore_verify_success` | weekly job |
| Alert `BackupStale` | no successful backup in 36 h -> critical | Prometheus |

Off-site copy: sync `BACKUP_DIR` to object storage in **another account/region** with versioning and a lifecycle rule
(for example `aws s3 sync /backups s3://crm-backups-eu/ --storage-class STANDARD_IA` from cron, or `rclone`). A backup that
lives on the database's own disk is not a disaster-recovery backup.

## Measured (rehearsed with the real scripts and real `pg_dump`/`pg_restore` 16.6)

On the synthetic 1M-candidate database (about 8 GB on disk: 8M related rows, 41 tables, 10 migrations), local machine, no network:

| Step | Result |
| --- | --- |
| `backup-postgres.sh` | **25 s**, 213 MB (custom format, compressed), checksum written, archive verified readable |
| `verify-restore.sh` (restore into a new database, `--jobs=4`, includes rebuilding every index) | **40 s** to restore; all 7 checks passed: 41 tables, 10 migrations recorded, organisations/users present, **0 invalid constraints, 0 invalid indexes, 0 orphaned applications** |
| Corrupted dump (one byte flipped) | detected by the checksum, restore **refused** (exit 3) before touching anything |
| Restore onto `crm_perf` (not a `*_restore/_scratch/_verify` name) | **refused** (exit 4) unless `--force-overwrite` |
| Missing file | exit 2 |

So the logical-restore RTO for a dataset of this size is under a minute on a local machine; on a managed database expect several times that
(network, disk, `CREATE INDEX` on smaller CPUs). Re-measure on your own data with `verify-restore.sh` and put the number in the RTO row above.
Not rehearsed here: provider PITR (it needs the provider account) and the off-site copy — do both in your first game day.

## Procedures

### A) "Somebody deleted or corrupted data" (you know roughly when) — PITR
1. **Stop the bleeding**: if it is an ongoing bug, roll back the release (`rollback.sh`).
2. In the provider console: restore to a **new** instance/database at a timestamp just before the incident. Never restore over production.
3. Verify the copy (row counts, the affected tenant's records).
4. Recover: either copy the affected rows back (`INSERT ... SELECT` through a foreign table / `pg_dump --table` from the copy),
   or, for a full failover, point `DATABASE_URL` at the restored instance and redeploy.
5. Write the post-mortem.

### B) "The database is gone" (region outage, deleted instance) — logical restore
```
# 1. a new empty PostgreSQL 16 (managed or `--profile local-db`), then:
createdb -h <host> -U <admin> crm_restore
# 2. restore the newest verified dump (checksum is verified first)
PGPASSWORD=... ./infrastructure/scripts/restore-postgres.sh /backups/crm-<stamp>.dump \
    postgresql://<admin>@<host>:5432/crm_restore
# 3. point the application at it and redeploy (DATABASE_URL, DIRECT_DATABASE_URL); run `migrate` (it is a no-op if up to date)
```
Data loss = time since the last dump (up to 24 h with the default schedule — lower `BACKUP_INTERVAL_SECONDS`, or rely on PITR for a smaller RPO).

### C) Restore one tenant / one table
```
pg_restore --schema=recruitment_crm --table=candidates --data-only --dbname=<scratch> crm-<stamp>.dump
```
Restore into a scratch database, `SELECT` the tenant's rows (`WHERE "organisationId" = ...`), and copy only those back.

## Rehearsal (do this, on a schedule)

* **Weekly, automatic**: `verify-restore.sh` from cron / a scheduled workflow. It fails loudly (exit 1, metric 0) if the dump
  is unreadable, the restore errors, tables are missing, constraints/indexes are invalid, or referential integrity is broken.
* **Quarterly, manual game day**: run procedure A and B end to end against staging, timing each step; update the RTO above with
  what you actually measured, not what you hoped.

## Database maintenance

* `autovacuum` is on and tuned in the compose file (`autovacuum_vacuum_scale_factor=0.05`, `analyze 0.02`) so large append-mostly
  tables (`activities`, `audit_logs`, `notifications`) keep their visibility maps (index-only scans depend on them). Managed
  services expose the same knobs.
* `pg_stat_statements` and the slow-query log (`log_min_duration_statement=500`) are enabled — the source for "which queries hurt".
* Watch dead tuples and table bloat; `audit_logs`/`activities` are append-only and will dominate disk: decide a retention policy
  (partition by month and drop old partitions) before they reach hundreds of millions of rows.
* Connections, disk, cache hit ratio, deadlocks, long transactions and replication lag are alerts (`alerts.yml`).

## Backup of the other components

* **Object storage** (documents, CVs): enable bucket versioning + a lifecycle rule; replicate cross-region for critical data.
* **Redis**: the queue instance persists with AOF (a restart keeps queued jobs); the cache instance is disposable by design.
* **Configuration / secrets**: the repository holds everything except secrets; secrets live in the secrets manager (`secrets.md`) —
  make sure *it* is recoverable.
