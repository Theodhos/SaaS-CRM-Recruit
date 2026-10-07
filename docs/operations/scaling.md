# Scaling

Principle: **make performance predictable, then add capacity when a measured signal says so.** Do not deploy the large
profile prematurely; move up one step at a time and re-measure (`performance.md` explains how).

## The scaling ladder

| Step | Trigger (measured) | Action | Cost of getting it wrong |
| --- | --- | --- | --- |
| 0 | — | One properly indexed PostgreSQL, 2 API replicas, 2 web replicas, 1-2 workers, Redis | — |
| 1 | API CPU > 70% for 15 min, or event-loop lag p99 > 200 ms | add API replicas (`API_REPLICAS`, `--scale`) | none — replicas are stateless |
| 2 | p95 latency > 300 ms with DB latency high | look at slow queries **first** (`DB_SLOW_QUERY_MS`, `pg_stat_statements`, Grafana "App-side query latency"), then indexes, then `CACHE_ENABLED=true`, only then a bigger DB | adding API replicas in front of a slow DB makes it slower |
| 3 | queue depth alert (`crm_queue_jobs{state="waiting"}`) | add workers (`--scale worker=N`) | none |
| 4 | Redis memory > 90% or evictions on the *queue* instance | raise `REDIS_MAXMEMORY`; investigate what is growing | evicted jobs are lost jobs |
| 5 | read-heavy load saturating the primary (CPU) after 1-3 | add a read replica for dashboards/reports **only** (below) | stale reads if used for read-your-writes flows |
| 6 | a component needs its own scaling/ownership | extract it (search, reporting...) | operational complexity — do it last |

## Capacity profiles

Start with A. Numbers are starting points, not promises; the measured baselines are in `performance.md`.

| | **A — small** | **B — medium** | **C — large** |
| --- | --- | --- | --- |
| API | 2 replicas x (2 vCPU, 4 GB) | 2-4 x (4 vCPU, 8 GB) | many, autoscaled |
| Web | 2 x (1 vCPU, 1 GB) or Vercel/CDN | 2-4 x (1-2 vCPU, 2 GB) | autoscaled |
| Worker | 1-2 x (2 vCPU, 4 GB) | 2+ x (4 vCPU, 8 GB) | dedicated pool per queue |
| PostgreSQL | 4 vCPU, 8-16 GB | 8 vCPU, 32 GB | primary + 1-2 read replicas, PITR |
| Redis | 1-2 GB (queue) + 1 GB (cache) | 4-8 GB | HA (Sentinel/managed) |
| Ops | Compose, one host | Compose on several hosts or a managed container service | orchestrator + autoscaling |

## Connection budget (the most common way scaling breaks)

Every API replica opens up to `connection_limit` PostgreSQL connections (default 10 in the URL). So:

```
total = (API_REPLICAS + WORKER_REPLICAS) x connection_limit  +  admin/migrations/monitoring (~10)   must be < max_connections
```

Example: 4 API + 2 workers x 10 = 60 (+10) — fine for `max_connections=100`. At 10 API replicas either lower
`connection_limit` to 5, or put PgBouncer/Supavisor in **transaction** mode in front (then keep migrations on the direct
URL — `DIRECT_DATABASE_URL`). Watch the `PostgresConnectionsHigh` alert.

## Horizontal API scaling

```
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --scale api-blue=4     # current colour
```
nginx resolves the service name through Docker's DNS every 5 s and round-robins all replicas — no reload needed. Retries
go to another replica **only** for connection errors and 502-504 on idempotent methods (nginx never retries POST/PATCH).
Scaling down is safe: a stopping replica turns `/health/ready` to 503 first and drains for `SHUTDOWN_DRAIN_MS`.

## Auto-scaling

Compose does not autoscale by itself. Two options, in order of effort:

1. **Managed container platform** (ECS/Cloud Run/Fly/Render...): deploy the same images; scale on *CPU 65%* and
   *request latency*; keep `min >= 2`. Use the platform LB instead of the bundled nginx (set `TRUST_PROXY` to the number of
   hops, and point its health check at `/health/ready`).
2. **Kubernetes** — only when you need it (multi-node scheduling, HPA on custom metrics, many services). The artefacts
   map directly: each Dockerfile is one Deployment; `/health` = liveness probe, `/health/ready` = readiness probe;
   `SHUTDOWN_DRAIN_MS` + `terminationGracePeriodSeconds: 45`; HPA on CPU and on `crm_queue_jobs` (worker) via KEDA;
   `active-color.conf` blue/green is replaced by the Deployment's rolling update. Nothing in the application changes.

Scale-in signals to avoid flapping: scale out fast (1-2 min), scale in slowly (10-15 min), never below 2 API replicas.

## Read replicas — when, and only when

Use one when the **primary's CPU** is saturated by read-heavy work that tolerates seconds of lag (dashboards, reports,
exports). Do **not** route read-your-writes flows (a form that redirects to the record it just saved) to a replica.
Practical steps: create the replica, add `REPORTS_DATABASE_URL`, and give the reporting repositories a second client.
The tenant guard applies unchanged (`scopedPrisma` wraps any client). Not implemented yet because the measured
bottlenecks (`performance.md`) are query shape and missing indexes, which a replica would only copy.

## Socket.IO across replicas

`apps/realtime` is a single instance today and rooms are tenant/user scoped (`org:<id>`, `user:<id>`). With more than one
realtime replica: add `@socket.io/redis-adapter` on the **queue** Redis, and either configure clients with
`transports: ['websocket']` (no sticky sessions needed) or enable stickiness at the load balancer. Note the gateway
currently expects a token in `handshake.auth`, while the session token is an httpOnly cookie, and the web app has no
socket client yet — realtime is not wired end-to-end (see `architecture.md`).

## Growing the data (100k -> 10M rows)

The design rule is **database size != browser data size**: pages load 20-100 rows, filters/sort/search run in
PostgreSQL, and aggregates are cached. What that means as tables grow:

* Lists: keep every hot list on an index that matches its `WHERE`/`ORDER BY` (`performance.md` lists them).
* `OFFSET` pagination is O(offset) whatever the index; the UI's page numbers make that acceptable to a few hundred
  thousand rows per tenant. Beyond that, move the largest lists to keyset (cursor) pagination — an API/UX change.
* `COUNT(*)` for "total pages" is O(rows) per request (250-450 ms at 1M candidates); cache it or show "many".
* Reports: `reports/overview` still reads every application of the tenant into memory (`performance.md`, "remaining
  bottlenecks") — the first thing to convert to SQL aggregation once tenants approach a million applications.
