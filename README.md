# Recruitment CRM + ATS Platform

Multi-tenant Recruitment CRM + Applicant Tracking System, built as a
pnpm/Turborepo monorepo: Next.js frontend, NestJS API, BullMQ worker,
Socket.IO realtime gateway, PostgreSQL/Prisma, Redis.

> **Status**: Phase 1 — architecture foundation only. Every module/route
> exists as a compiling skeleton; no business functionality, forms, or
> dashboards are implemented yet. See
> [docs/decisions/ADR-001-architecture.md](docs/decisions/ADR-001-architecture.md).

> **Windows note**: `pnpm build` for `apps/web` uses Next.js's `output: standalone` mode, which symlinks dependencies into `.next/standalone` during the trace step. Windows blocks unprivileged symlink creation unless [Developer Mode](https://learn.microsoft.com/windows/apps/get-started/enable-your-device-for-development) is on (or you run as Administrator) — you'll see `EPERM: operation not permitted, symlink`. This doesn't affect `pnpm dev`, and Docker builds (Linux containers) are unaffected.

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 (`corepack enable` will provide the pinned version automatically)
- Docker + Docker Compose (for Postgres/Redis/MinIO/Mailhog locally)

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Copy and fill in environment variables
cp .env.example .env
# At minimum, set real values for JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
# SESSION_SECRET (any random 32+ char string works for local dev).

# 3. Start local infrastructure (Postgres, Redis, MinIO, Mailhog)
docker compose up -d postgres redis minio mailhog

# 4. Generate the Prisma client and run migrations
pnpm db:generate
pnpm db:migrate

# 5. Seed the permission catalog + a minimal dev fixture (1 organisation,
#    1 admin + 1 recruiter user, 1 company, 1 contact, 1 candidate, 1 job,
#    1 pipeline with stages, 1 application, 2 activities). Skipped
#    automatically when NODE_ENV=production. Login: admin@acme-recruiting.dev
#    or recruiter@acme-recruiting.dev, password Password123!
pnpm db:seed

# 6. Run everything in dev mode
pnpm dev
```

This starts:

| App               | URL                          | Purpose                                                     |
| ----------------- | ---------------------------- | ----------------------------------------------------------- |
| `apps/web`        | http://localhost:3000        | Next.js frontend                                            |
| `apps/api`        | http://localhost:4000/api/v1 | NestJS REST API (`/api/v1/docs` for Swagger, non-prod only) |
| `apps/api` health | http://localhost:4000/health | Liveness/readiness probe                                    |
| `apps/realtime`   | ws://localhost:4001          | Socket.IO gateway                                           |
| `apps/worker`     | —                            | Background job processors (no HTTP surface)                 |
| MinIO console     | http://localhost:9001        | S3-compatible storage (local dev)                           |
| Mailhog           | http://localhost:8025        | Captured outbound email (local dev)                         |

## Common commands

```bash
pnpm dev              # run all apps in watch mode (Turborepo, parallel)
pnpm build             # build all apps/packages in dependency order
pnpm lint               # lint all apps/packages
pnpm type-check          # type-check all apps/packages
pnpm test                # run unit tests
pnpm format               # format the repo with Prettier

pnpm db:generate           # regenerate the Prisma client after a schema change
pnpm db:migrate              # create + apply a dev migration (interactive)
pnpm db:migrate:deploy         # apply pending migrations (CI/production, non-interactive)
pnpm db:seed                     # seed permission catalog + minimal dev fixture (non-production only)
pnpm db:studio                     # open Prisma Studio
```

Turborepo caches and parallelizes all of the above across the monorepo —
running `pnpm lint` at the root lints every app/package with correct
dependency ordering, not each one independently from scratch.

## Running a single app

```bash
pnpm --filter @crm/api dev
pnpm --filter @crm/web dev
pnpm --filter @crm/worker dev
pnpm --filter @crm/realtime dev
```

## Docker Compose profiles

`docker compose up -d` (no profile) starts only the stateful infra
(Postgres, Redis, MinIO, Mailhog) — the intended local dev setup, where you
run the four apps via `pnpm dev` for fast iteration. `docker compose --profile full up -d`
additionally builds and runs `api`/`web`/`worker`/`realtime` as containers,
useful for testing the production Docker images
(`infrastructure/docker/*.Dockerfile`) locally.

## Repository layout

See [docs/architecture/overview.md](docs/architecture/overview.md) for the
full breakdown. Short version:

```
apps/            web (Next.js) · api (NestJS) · worker (BullMQ) · realtime (Socket.IO)
packages/         ui · types · config · validation · database · auth · logger · storage · utils
infrastructure/    docker · nginx · scripts
docs/               architecture · database · api · decisions
```

## Documentation

- [Architecture overview](docs/architecture/overview.md)
- [Frontend architecture](docs/architecture/frontend.md)
- [Backend architecture](docs/architecture/backend.md)
- [Database architecture](docs/architecture/database.md) ·
  [Entity relationships](docs/database/relationships.md)
- [Authentication](docs/architecture/authentication.md) ·
  [Authorization (RBAC)](docs/architecture/authorization.md)
- [Multi-tenancy](docs/architecture/multi-tenancy.md)
- [API conventions](docs/api/conventions.md)
- [ADR-001: Phase 1 architecture foundation](docs/decisions/ADR-001-architecture.md)
- [ADR-002: Entity simplification, single-role RBAC, real seed data](docs/decisions/ADR-002-schema-simplification.md)
