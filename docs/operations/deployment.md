# Deployment, rollback and database migrations

Everything here is provider-neutral: a Linux host (or VM group) with Docker Compose v2, an S3-compatible bucket, a
managed PostgreSQL and a DNS name (ideally behind Cloudflare). Nothing in the repository provisions cloud resources.

> **Status of these files.** The Dockerfiles, `docker-compose.prod.yml`, the blue/green scripts and the GitHub
> workflows were written and syntax-checked (nginx with a real `nginx -t`, shell with `bash -n`, YAML/JSON parsed) but
> **could not be executed on the machine they were written on (no Docker available)**. The first CI run builds the
> images and is the real test; treat the first staging deploy as the rehearsal.

## First-time setup (once per environment)

1. **Secrets.** `cp .env.production.example .env.production`, fill every `CHANGE_ME`
   (`openssl rand -base64 48` for each secret). Create `secrets/metrics_token` (same as `METRICS_TOKEN`),
   `secrets/slack_webhook_url`, `secrets/grafana_admin_password`. Both paths are git-ignored.
2. **Images.** CI publishes `api`, `web`, `worker`, `realtime` and `migrate` to GHCR
   (`ghcr.io/<owner>/<repo>/<image>:<branch>-<sha7>` and `:<sha>`). Set `REGISTRY` in `.env.production`.
   `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_REALTIME_URL` are baked into the web image at build time — set the GitHub
   repository *variables* of the same names before the first build.
3. **Database.** Create the database and two roles: `crm_app` (DML only, used by the API/worker) and `crm_migrator`
   (DDL, used by `migrate`). Apply the schema: `docker compose ... --profile migrate run --rm migrate`.
   Seed the permission catalogue once: `pnpm db:seed` (it refuses to seed demo data when `NODE_ENV=production`).
4. **Start.**
   ```
   docker compose --env-file .env.production -f docker-compose.prod.yml --profile blue up -d --wait
   docker compose --env-file .env.production -f docker-compose.prod.yml -f docker-compose.observability.yml up -d
   ```
5. **Edge / TLS.** Put Cloudflare (or a cloud load balancer) in front; it terminates TLS and forwards to port
   `EDGE_PORT`. If you are *not* behind Cloudflare, replace `infrastructure/nginx/cloudflare-ips.conf` with your
   balancer's CIDR (see the comments in that file). Cloudflare: proxy the record, set SSL mode *Full (strict)*, and
   add **no cache rule for `/api/*`** (private tenant data must never be cached publicly). Only `/_next/static/*` and
   `/icon.svg` are safe to cache.
6. **CI/CD.** Create GitHub Environments `staging` and `production` (production with *required reviewers*), add the
   secrets/variables listed at the top of `.github/workflows/deploy.yml`.

## Releasing

Automatic: merge to `main` -> CI -> **staging** deploy. Tag `vX.Y.Z` -> **production** deploy (after approval).
Manual: `TAG=<image tag> REGISTRY=... ./infrastructure/scripts/deploy.sh` on the host.

`deploy.sh` is blue/green (two colours of `api`+`web`, one is live):

1. apply migrations (expand-only, below);
2. start the **idle** colour with the new tag and wait until it is healthy **and ready** (`/health/ready`);
3. smoke-test it over the internal network;
4. rewrite `infrastructure/nginx/active-color.conf`, `nginx -t`, `nginx -s reload` — a graceful reload, no dropped
   connections;
5. post-flip smoke test through the edge; on failure it **flips back automatically**;
6. replace workers/realtime in place, keep the old colour warm for `GRACE_SECONDS` (default 300), then stop it.

Any failure before step 4 leaves production untouched.

## Rollback

* **Application:** `./infrastructure/scripts/rollback.sh` (or the *Rollback* GitHub workflow). The previous colour's
  containers still exist, so this takes seconds: start it, wait for readiness, flip the edge, stop the bad colour.
* **After the grace period** the old colour is stopped, not deleted — `rollback.sh` starts it again. To return to an
  older tag than the previous release, run `deploy.sh` with that tag (it deploys to the idle colour like any release).
* **Database:** see below — this is why migrations must be backward compatible.

## Database migrations: expand -> migrate -> contract

The old and new application versions run **at the same time** during a release (and after a rollback the old one runs
against the new schema). Therefore every migration must be safe for the previous release:

| Release | Allowed |
| --- | --- |
| **Expand** | add nullable columns, add tables, add **indexes**, add enum values, widen types. |
| **Migrate** | deploy code that writes/reads the new shape; backfill data in batches (a job, not one giant `UPDATE`). |
| **Contract** *(a later release, after the old code is gone)* | drop columns/tables, tighten `NOT NULL`, rename. |

Never drop or rename something in the same release as the code that stops using it.

**Index rollout on a large table.** `CREATE INDEX` blocks writes while it builds. For any table over ~1M rows, create
the index first without blocking, then deploy the migration (it uses `IF NOT EXISTS`, so it is a no-op):

```sql
-- one statement per session, outside a transaction; may take minutes on a big table
SET statement_timeout = 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "candidates_organisationId_createdAt_idx"
  ON "candidates"("organisationId", "createdAt" DESC);
```

Check `pg_index.indisvalid` afterwards (a failed concurrent build leaves an *invalid* index: drop it and retry).

**Prisma drift.** `prisma migrate dev` treats an index that exists in the database but not in `schema.prisma` as drift.
Declare every index in `schema.prisma` (partial indexes and GIN/trigram indexes cannot be expressed there — if you
need one, apply it as a hand-written migration and do not run `migrate dev` against that database).

## Zero-downtime checklist

- [ ] Migration is expand-only and ran before the flip.
- [ ] `/health/ready` is 200 on the idle colour (database reachable).
- [ ] `SHUTDOWN_DRAIN_MS` >= the load balancer's health-check interval, so a stopping replica is drained first.
- [ ] `stop_grace_period` (30 s in the compose file) is longer than your slowest request (CV parsing: 10 MB).
- [ ] `KEEP_ALIVE_TIMEOUT_MS` (65 s) exceeds the proxy idle timeout — prevents sporadic 502s on reused connections.
