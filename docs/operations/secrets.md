# Secrets management

## Rules

1. **No secret is ever committed or baked into an image.** `.env`, `.env.*` (except `*.example`) and `secrets/` are
   git-ignored; `.dockerignore` keeps them out of build contexts; images receive configuration only at runtime.
2. **Different secrets per environment** (staging never shares a database password, JWT secret or storage key with production).
3. **Least privilege per database role**: the app connects as `crm_app` (DML only); migrations run as `crm_migrator`
   (DDL) on a direct connection, only inside the one-shot `migrate` container; monitoring uses a read-only `pg_monitor`
   role; backups use a read-only role. A compromised API container cannot drop tables.
4. **Rotate** on people leaving, on any suspected leak, and at least yearly. Every secret below has an owner and a rotation
   procedure.
5. **Never log secrets**: pino redacts `Authorization`, `Cookie`, `Set-Cookie`, `x-api-key`; the slow-query log prints the
   parameterised SQL only.

## Inventory

| Secret | Used by | Rotation |
| --- | --- | --- |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET` | api, realtime | rolling restart signs out all users (they log in again) — schedule it |
| `DATABASE_URL` (app role), `DIRECT_DATABASE_URL` (migrator) | api / worker, migrate | change the role password, update the secret, redeploy |
| `REDIS_PASSWORD` | api, worker, realtime, redis, exporters | update everywhere, restart Redis last; queue jobs persist (AOF) |
| `STORAGE_ACCESS_KEY_ID` / `SECRET_ACCESS_KEY` | api, worker | create the new key pair, deploy, revoke the old one |
| `SMTP_PASSWORD` | api / worker | provider-specific |
| `METRICS_TOKEN` (= `secrets/metrics_token`) | api, prometheus | update both, redeploy |
| `secrets/slack_webhook_url`, `grafana_admin_password` | alertmanager, grafana | regenerate in Slack / Grafana |
| `DEPLOY_SSH_KEY` (GitHub) | CI deploy | generate a new deploy key, add its public half to the host, delete the old |
| `SMOKE_EMAIL` / `SMOKE_PASSWORD` | CI smoke test | a dedicated **low-privilege** account, never a real user |

## Where to keep them

* **Local / staging host**: `.env.production` with `chmod 600`, owned by the deploy user. Acceptable for one host.
* **Production**: a secrets manager (AWS Secrets Manager / GCP Secret Manager / Vault / Doppler), rendered into
  `.env.production` by the deploy step, or injected as environment by the container platform. The compose file also
  works with Docker/Swarm secrets (`*_FILE` variables) if you extend the services.
* **CI**: GitHub Environments (`staging`, `production`) with required reviewers on `production`. Secrets are only
  available to jobs that target the environment.

## Note on `env_file`

`docker-compose.prod.yml` passes the whole `.env.production` to every application container. That is convenient, but it
means the web container also receives database credentials it does not use. If you want strict isolation, split it into
`.env.api`, `.env.web`, `.env.worker` and point each service's `env_file` at its own file. (The browser bundle never
contains server secrets: only `NEXT_PUBLIC_*` values are inlined into it, and those are public by definition.)

## If a secret leaks

1. Rotate it (table above) — revoke first, then investigate.
2. For `JWT_*`: rotation invalidates every session, which is the desired outcome.
3. Check the audit log (`audit_logs`) and the access logs in Loki for the exposure window (the correlation id ties a
   request to its log lines).
4. If it was committed to git, rotation is mandatory even after removing the commit — history is copied.
