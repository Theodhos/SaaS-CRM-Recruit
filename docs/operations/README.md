# Operations

Everything needed to run the platform in production, in the order you will need it.

| Document | Answers |
| --- | --- |
| [architecture.md](architecture.md) | What runs where; what makes the API stateless; how it fails |
| [deployment.md](deployment.md) | First-time setup, blue/green releases, rollback, safe database migrations |
| [scaling.md](scaling.md) | When and how to add capacity; capacity profiles; connection budget; when (not) to use Kubernetes |
| [caching.md](caching.md) | The Redis design: cache, rate limits, locks, queues; correctness and failure behaviour |
| [monitoring.md](monitoring.md) | Metrics, dashboards, alerts, centralised logging, correlation ids |
| [runbook.md](runbook.md) | What to do when an alert fires |
| [backup-and-recovery.md](backup-and-recovery.md) | RPO/RTO, backups, point-in-time recovery, the restore rehearsal |
| [secrets.md](secrets.md) | Inventory, rotation, least-privilege database roles |
| [performance.md](performance.md) | Before/after measurements, index report, remaining bottlenecks, how to re-run the load tests |

## Where the code lives

| Path | What |
| --- | --- |
| `infrastructure/docker/*.Dockerfile` | production images (multi-stage, non-root, health checks) |
| `docker-compose.prod.yml` | production topology, blue/green, Redis x2, optional local PostgreSQL + backups |
| `docker-compose.observability.yml` | Prometheus, Alertmanager, Grafana, Loki, Promtail, exporters |
| `infrastructure/nginx/` | edge / load balancer config, Cloudflare ranges, active colour |
| `infrastructure/scripts/` | `deploy.sh`, `rollback.sh`, `smoke-test.sh`, backup/restore/verify, `check-bundles.mjs` |
| `infrastructure/observability/` | scrape config, alert rules, dashboards, log pipeline |
| `.github/workflows/` | CI (lint, typecheck, test, build, security, Docker), deploy, rollback |
| `.env.production.example` | every production variable, documented |
