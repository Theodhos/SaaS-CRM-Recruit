# Monitoring, alerting and logging

```
api / worker --/metrics--> Prometheus --> Grafana (dashboard "CRM — platform overview")
containers, host, Redis, PostgreSQL --exporters--> Prometheus --> Alertmanager --> Slack / PagerDuty
every container --stdout JSON--> Promtail --> Loki --> Grafana (Explore / the "Errors" panel)
blackbox probes from inside the network --> Prometheus (is the edge reachable, how fast?)
browsers --Web Vitals--> API --> web_vitals_value histogram --> Grafana
```

Start it: `docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.observability.yml up -d`
(create `secrets/metrics_token`, `secrets/slack_webhook_url`, `secrets/grafana_admin_password` first; Grafana listens on
`127.0.0.1:3001` — reach it through your VPN/SSH tunnel, never the public internet).

## What is measured

| Area | Metric (Prometheus name) | Source |
| --- | --- | --- |
| Request rate, errors, latency p50/p95/p99 | `http_requests_total`, `http_request_duration_seconds` | API middleware; labels `method`, **route pattern**, `status_code` |
| Slow routes | same, `topk(... by route)` | Grafana "Slowest routes" |
| Node runtime | `nodejs_eventloop_lag_p99_seconds`, `nodejs_heap_size_used_bytes`, `process_cpu_seconds_total` | `prom-client` default metrics |
| Database (app side) | `crm_db_queries_total`, `crm_db_query_duration_seconds` | Prisma statement events (`DB_QUERY_METRICS=true`) |
| Database (server side) | `pg_stat_activity_count`, cache hit ratio, deadlocks, `pg_stat_statements` | postgres-exporter |
| Slow queries | WARN log `slow query 812ms: SELECT ...` | `DB_SLOW_QUERY_MS` (parameterised SQL only, never bound values) |
| Redis | memory, hit ratio, evictions, commands/s | redis-exporter (queue and cache instances separately) |
| Cache | `crm_cache_requests_total{result=hit\|miss\|bypass\|error}` | API |
| Queues | `crm_queue_jobs{queue,state}`, `crm_job_duration_seconds` | worker (see status below) |
| Containers / host | CPU, memory, restarts, disk | cAdvisor, node-exporter |
| Reachability | `probe_success`, `probe_duration_seconds` for `/lb-health`, `/health/ready`, `/login` | blackbox |
| Backups | `crm_backup_last_success_timestamp_seconds`, `crm_backup_restore_verify_success` | backup scripts -> node-exporter textfile |
| Frontend | `web_vitals_value{name="LCP"\|"INP"\|"CLS"\|"TTFB"}` | browsers (see below) |

`/metrics` is disabled (404) unless `METRICS_TOKEN` is set, requires `Authorization: Bearer <token>`, and is **not routed
by the edge** — Prometheus scrapes replicas directly over the internal network.

**Cardinality rule**: labels are route *patterns* (`/api/v1/candidates/:id`), never raw URLs, and never a tenant, user or
record id. A unit test asserts that three different ids produce one series.

## Alerts (`infrastructure/observability/prometheus/alerts.yml`)

Critical (page): API replica down, platform unreachable from the probe, no healthy API, 5xx rate > 2 %, PostgreSQL down,
disk < 15 %, memory < 10 %, queue-Redis evicting keys, no worker running, backup older than 36 h.
Warning (work hours): p95 > 1 s, p99 > 3 s, event-loop lag, heap > 85 %, sustained 429s, queue backlog, failing jobs,
dead-letter growth, PostgreSQL connections > 80 %, cache hit ratio < 95 %, deadlocks, long transactions, Redis memory,
low cache hit rate, container restart loops, host CPU.
Symptom alerts are inhibited when the platform itself is down. Each critical alert links a section of `runbook.md`.

## Logging

* Structured JSON from pino (API, worker, realtime) and from nginx; one line per event.
* **One correlation id per request**, minted before any guard runs (so even a 401 or 429 has one), honouring an
  `X-Request-Id` from the edge, echoed in the `X-Request-Id` response header and in the `requestId` field of every
  response envelope. In Grafana, click the `request_id` in a log line to find every line of that request across replicas.
* **Redacted**: `Authorization`, `Cookie`, `Set-Cookie` and `x-api-key` — the session/refresh tokens travel as cookies,
  so they were previously logged in access logs.
* Probe traffic (`/health`, `/metrics`) is excluded from access logs; nothing else is.
* Stack traces are never returned to clients (the exception filter returns a generic 500); they are logged server-side.

## What is intentionally not done (yet)

* **Worker metrics**: the worker has no HTTP surface today (its processors are stubs). `prometheus.yml` already scrapes
  `worker:9464` and the dashboard/alerts are defined for `crm_queue_jobs` / `crm_job_duration_seconds`; the exporter
  itself lands with the first real processor. Until then those panels are empty and `WorkerDown` uses container health.
* **Web Vitals**: the histogram, dashboard panels and alert thresholds exist; the browser reporter is a small client
  component plus one public endpoint, listed in `performance.md` as a follow-up so it can be reviewed as a UI change.
* **Tracing** (OpenTelemetry) — add when a request crosses more than the API and the database.
