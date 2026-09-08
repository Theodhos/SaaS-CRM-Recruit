# Architecture Overview

## What this is

A multi-tenant Recruitment CRM + ATS platform: candidate/company/contact CRM,
a configurable ATS pipeline (Candidate → Application → Job), activity
tracking, tasks/calendar/interviews, email, documents, placements/fees/
retainers/renewals, talent pools & distribution lists, reporting/analytics,
notifications, RBAC, and audit logging — designed to scale to hundreds of
thousands of candidates and thousands of jobs across many organisations.

This document is the map; deeper docs live alongside it:
[frontend.md](./frontend.md), [backend.md](./backend.md),
[database.md](./database.md), [authentication.md](./authentication.md),
[authorization.md](./authorization.md), [multi-tenancy.md](./multi-tenancy.md),
[../database/relationships.md](../database/relationships.md),
[../api/conventions.md](../api/conventions.md).

## System components

```
                         ┌──────────────────┐
                         │   apps/web        │  Next.js (App Router)
                         │   :3000            │  React Query + Zustand
                         └─────────┬─────────┘
                                   │ REST (JSON, versioned) + WebSocket
                       ┌───────────┼────────────────┐
                       ▼                             ▼
            ┌─────────────────┐            ┌───────────────────┐
            │   apps/api        │            │  apps/realtime     │
            │   NestJS :4000     │            │  Socket.IO :4001    │
            │   REST + Swagger   │            │  notifications, live │
            └───┬───────────┬──┘            │  status updates      │
                │           │                └─────────┬──────────┘
                │           │ enqueue jobs               │ pub/sub (Phase 2)
                │           ▼                             │
                │   ┌───────────────┐                    │
                │   │  Redis          │◄───────────────────┘
                │   │  (cache, BullMQ) │
                │   └───────┬───────┘
                │           │ consume jobs
                │           ▼
                │   ┌───────────────────┐
                │   │  apps/worker         │  BullMQ processors:
                │   │  (background jobs)   │  email, documents, CV parsing,
                │   └───────────────────┘  notifications, analytics,
                │                            reports, imports/exports,
                ▼                            scheduled tasks
      ┌───────────────────┐
      │  PostgreSQL          │  one schema, organisationId on every
      │  (Prisma)             │  tenant-scoped table (see multi-tenancy.md)
      └───────────────────┘

      ┌───────────────────┐
      │  S3-compatible store  │  CVs, contracts, offer letters — never
      │  (S3 / R2 / MinIO)     │  stored as DB binary. Metadata in Postgres,
      └───────────────────┘  bytes in object storage (see backend.md).
```

## Monorepo layout

```
apps/
  web/        Next.js frontend
  api/        NestJS REST API (source of truth for business logic)
  worker/     BullMQ background job processors
  realtime/   Socket.IO gateway for live updates
packages/
  ui/         shadcn/ui-based component library (reusable, domain-agnostic)
  types/      Shared TypeScript contracts (entities, API envelope, enums)
  config/     Validated environment config (Zod) + shared constants (queue names)
  validation/ Shared Zod schemas (forms on web, input validation on api)
  database/   Prisma schema, generated client, tenant-scoping (scopedPrisma)
  auth/       JWT strategy, guards, decorators — the one auth implementation
  logger/     Structured logging (pino) factory
  storage/    S3-compatible file storage abstraction (StorageProvider)
  utils/      Small dependency-free shared utilities
infrastructure/
  docker/     Per-app Dockerfiles
  nginx/      Reference reverse-proxy config
  scripts/    One-off scaffolding scripts (module/route generators)
docs/         This documentation
```

Turborepo + pnpm workspaces run builds/lint/type-check/test across all of
the above with correct dependency ordering and caching (`turbo.json`).

## Why apps are split this way

- **api vs worker vs realtime, as separate deployables.** A slow CV-parsing
  job or a stuck WebSocket connection must never degrade REST API latency.
  Each scales and restarts independently; `docker-compose.yml` and the
  per-app Dockerfiles reflect that.
- **web never talks to Postgres.** All data access goes through `apps/api`'s
  versioned REST contract. This keeps authorization, tenant isolation, and
  validation in one enforced place instead of duplicated between a Next.js
  API route layer and a separate backend.
- **packages/ hold contracts and infrastructure primitives, not business
  logic.** `packages/database`, `packages/auth`, `packages/storage` etc. are
  deliberately "boring" and stable; domain logic (what a Candidate _means_,
  how a pipeline stage transitions) lives in `apps/api/src/modules/*`.

## Activity system

Every interaction (call, email, meeting, interview, note, status change,
document upload, placement, follow-up) is one row in a single `Activity`
table (`packages/database/prisma/schema.prisma`), not a separate table per
type. It optionally references whichever of Candidate/Company/Contact/Job/
Application it's about. This keeps "show me everything that happened on
this candidate" a single indexed query instead of a UNION across many
tables, and lets the frontend render one activity feed component
(`components/shared`) for every entity type.

## ATS pipeline

`Candidate → Application → Job`, never `Candidate → Job` directly — a
candidate can apply to many jobs, and each application tracks its own
`pipelineStageId`. Pipelines and their stages
(`Pipeline`/`PipelineStage`) are organisation-configurable rows, not
hard-coded strings — no frontend or backend code should ever compare a
status against a literal like `"Interview"`.

## What Phase 1 deliberately does NOT include

No CRUD business logic, no real forms, no dashboards, no analytics
computation, no fake/demo data. Every domain module in `apps/api/src/modules`
is a compiling skeleton (controller/service/repository/module + empty dto/
entities/interfaces/guards folders); every `apps/web` route is a placeholder
page. See [../decisions/ADR-001-architecture.md](../decisions/ADR-001-architecture.md)
for the reasoning and the Phase 2 task list.
