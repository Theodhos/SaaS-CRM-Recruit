# Runbook

Each alert in `infrastructure/observability/prometheus/alerts.yml` points at a section here. First minute for anything:
open Grafana -> "CRM — platform overview"; look at **error rate, p95, replicas up, queue depth, DB connections**.

Useful commands (run on the compose host; add `--env-file .env.production -f docker-compose.prod.yml`):

```
docker compose ps
docker compose logs -f --tail=200 api-blue              # or api-green — see infrastructure/nginx/active-color.conf
docker compose exec api-blue wget -qO- http://localhost:4000/health/ready
docker compose exec redis redis-cli info memory
```

## Platform unreachable
`PlatformUnreachable` = the blackbox probe cannot fetch `/lb-health`, `/health/ready` or `/login` through the edge.
1. `docker compose ps` — is `edge` up? `docker compose logs edge` — `nginx -t` errors after a config change?
2. `/lb-health` OK but `/health/ready` failing -> API tier or database (next sections).
3. Only `/login` failing -> the web tier: `docker compose logs web-<colour>`.
4. Outside your network too? Check Cloudflare status / DNS / certificate expiry.
5. Recent deploy? `./infrastructure/scripts/rollback.sh`.

## API instance down / no healthy API replicas
1. `docker compose ps` — restart loop? `docker compose logs api-<colour> --tail=100`.
2. Typical causes: bad environment (`loadEnv` fails fast with a readable error), database unreachable, a module missing at
   runtime (`MODULE_NOT_FOUND` — CI's `check-bundles.mjs` exists to prevent this).
3. If a release caused it: `rollback.sh`. If one replica: `docker compose up -d --force-recreate api-<colour>`.

## High error rate (5xx)
1. Grafana "5xx by route" and the Loki "Errors" panel; click a `request_id` to see the whole request.
2. One route -> a bug or a slow query (`slow query` WARN lines with the SQL). Everything -> database or Redis (next).
3. Started with a deploy -> `rollback.sh` first, investigate after.

## Slow API (p95/p99) / event-loop lag
1. Is the **database** slow? "App-side query latency" up -> slow-query log, `pg_stat_statements`, missing index, lock waits
   (`pg_stat_activity` where `wait_event_type = 'Lock'`). Fix the query/index; do **not** add API replicas in front of a slow DB.
2. Event-loop lag high, DB fast -> CPU-bound work in a request (CV parsing, huge JSON). Scale replicas as a stopgap;
   move the work to the worker.
3. Heap near limit -> an unbounded result set (`reports/overview` reads every application of a tenant). Enable
   `CACHE_ENABLED=true` to take repeated dashboard loads off the process; long-term convert to SQL aggregation.

## PostgreSQL down / connections high / deadlocks / long transactions
* **Down**: readiness goes 503 and the LB drains replicas; liveness stays 200 so they are not restart-looped. Managed
  provider: check its status page/console, fail over to the replica/standby if configured. Do not restart the API tier.
* **Connections > 80 %**: `replicas x connection_limit` is too high (`scaling.md`, "Connection budget"). Lower
  `connection_limit` or introduce a pooler; find idle-in-transaction sessions:
  `SELECT pid, state, now()-xact_start FROM pg_stat_activity WHERE state <> 'idle' ORDER BY xact_start;`
* **Long transaction** (> 5 min): find it above; `SELECT pg_cancel_backend(pid)` (gentle) before `pg_terminate_backend`.
* **Disk < 15 %**: grow the volume first; then look for bloat (`pg_stat_user_tables.n_dead_tup`), a runaway table
  (`audit_logs`, `activities`), WAL retention.

## Redis
* **Cache Redis down**: no user impact by design (responses identical, slightly slower dashboards). Replicas reconnect on their
  own. If `HEALTH_REQUIRE_REDIS=true` the replicas are drained — set it `false` if you prefer to keep serving.
* **Queue Redis down**: jobs cannot be enqueued; workers resume when it returns; AOF preserves queued jobs.
* **`RedisQueueEvicting` (critical)**: the queue instance is evicting keys, i.e. losing jobs. It must run
  `maxmemory-policy noeviction`. Raise `REDIS_MAXMEMORY` and find what fills it (`redis-cli --bigkeys`).
* **Cache hit ratio low**: TTL too short, or tenants that write constantly (every write invalidates that tenant's cache).

## Queue backlog / failing jobs / dead letters
1. `crm_queue_jobs{queue}` — which queue? Are workers up (`WorkerDown`)?
2. Scale workers: `docker compose up -d --scale worker=4`.
3. Failing jobs: worker logs for the job id; jobs retry with exponential backoff and land in the failed set (dead letter)
   after their attempts; fix the cause, then retry from the failed set.

## Rate limiting spike (429)
Legitimate burst or abuse? Check the source IPs in the edge logs (`remote_addr` is the real client behind Cloudflare). Abuse:
add a Cloudflare rule. Legit: raise `RATE_LIMIT_MAX_REQUESTS` (it is enforced across all replicas when
`THROTTLER_STORAGE=redis`). If *everyone* is being limited, `TRUST_PROXY` is probably not set (all users share the proxy's IP).

## Backups
`BackupStale` -> `docs/operations/backup-and-recovery.md` ("Backup failed"). A failing backup is critical; do not wait for the next night.

## After the incident
Write down: timeline (from the correlation ids), root cause, what detected it (or should have), and the alert/threshold
or test you are adding. Update this runbook.
