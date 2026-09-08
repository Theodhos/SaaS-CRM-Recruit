# Database Architecture

PostgreSQL + Prisma. Schema: `packages/database/prisma/schema.prisma`.
Relationship narrative and ERD: [../database/relationships.md](../database/relationships.md).

## Conventions

- **Minimum viable fields.** Every entity carries only what's needed to
  identify and operate it — e.g. `Candidate` has 10 business fields, not 50. Extending a model later is cheap; stripping an over-built one out
  from under working code is not. See `packages/database/prisma/schema.prisma`
  for the current field lists — they are the source of truth, not this doc.
- **IDs**: `cuid()` everywhere — collision-safe without a central sequence,
  URL-safe, and (unlike auto-increment ints) don't leak row counts to
  clients.
- **Timestamps**: `createdAt` on every model; `updatedAt` on models that
  are actually mutated after creation (most of them — exceptions like
  `Activity`, `AuditLog`, and `Renewal` are effectively append-only).
- **Soft delete**: only the handful of high-value, user-facing records use
  a nullable `deletedAt` instead of a hard `DELETE` — `Candidate`,
  `Company`, `Contact`, `Job`, `Application`. Everything else is either
  append-only (`Activity`, `AuditLog`) or safe to hard-delete (join tables,
  `Comment`, `Document`). Soft-delete was deliberately NOT added to every
  table — see the spec principle "use engineering judgement."
- **Money**: `Decimal @db.Decimal(12, 2)`, never `Float` — fees, salaries,
  and retainer amounts must not accumulate floating-point error.
- **Enums vs. strings**: Prisma `enum` for closed, code-controlled sets
  (`JobStatus`, `ActivityType`, ...). Plain `String` where the value is
  open-ended (`Candidate.source`, `Notification.type`,
  `UserEngagementEvent.eventType`, `AuditLog.action`) — adding a new job
  source or a new audited action shouldn't require a migration.
- **No polymorphic entityType/entityId.** `Comment`, `Document`, `Activity`,
  `Task`, and `CalendarEvent` all use explicit nullable foreign keys per
  related entity, never a generic `(entityType, entityId)` pair — see
  [../database/relationships.md](../database/relationships.md#why-commentdocument-use-plain-fks-not-polymorphism)
  for why, and for the one deliberate exception (`Tag`/`CandidateTag`).

## RBAC is intentionally simple

`User.roleId` is a single required foreign key to `Role` — not a
many-to-many. One user, one role. `Role` is organisation-scoped and holds
its permissions via `RolePermission`, a many-to-many join against the
global, code-defined `Permission` catalog. See
[authorization.md](./authorization.md).

## Generated client

`generator client { output = "../src/generated/client" }` — the client is
generated into `packages/database/src/generated/client` (gitignored) rather
than `node_modules/.prisma`, so `@crm/database`'s `src/index.ts` can
re-export Prisma's types directly (`export * from './generated/client'`)
without every consumer needing its own `@prisma/client` resolution.

## Tenant scoping

See [multi-tenancy.md](./multi-tenancy.md) — `packages/database/src/tenant.ts`
(`scopedPrisma`) is the enforcement layer that lives next to the schema.

## Migrations

`pnpm db:migrate` (dev, interactive) / `pnpm db:migrate:deploy` (CI/prod,
non-interactive) at the repo root, proxied to `packages/database` via
Turborepo. Migrations are committed to
`packages/database/prisma/migrations/` — as of this phase, `prisma
generate` has been run and validated (schema compiles, full relational
graph is consistent), but no migration has been applied against a running
Postgres instance yet — this dev machine has neither Docker nor a local
Postgres install. Running `docker compose up -d postgres && pnpm db:migrate`
against a real database is the first Phase 2 action item.

## Seeding

`packages/database/prisma/seed/` is two-tier:

1. **Permissions** (`permissions.ts`) — the code-defined capability
   catalog, upserted in every environment including production.
2. **Dev fixtures** (`dev-fixtures.ts`) — one minimal, idempotent
   organisation/role/user/company/contact/candidate/job/pipeline/
   application/activity graph, seeded only when `NODE_ENV !== 'production'`.
   This exists purely to prove every relationship in the schema wires up
   correctly end to end — not to populate a demo. It creates exactly the
   set the spec asked for: 1 organisation, 1 admin + 1 recruiter user, 1
   company, 1 contact, 1 candidate, 1 job, 1 pipeline with 7 stages, 1
   application, and 2 activities (one candidate-facing, one contact-facing,
   to exercise both sides of the Activity system's nullable FKs).

## Performance posture (established now, exercised in Phase 2)

- Every tenant-scoped model is indexed on `organisationId`, plus compound
  indexes for the query patterns already known to matter
  (`[organisationId, status]` on `Candidate`/`Job`/`Application`,
  `[organisationId, createdAt]` on `Activity`/`AuditLog`,
  `ownerId` on `Company`/`Contact`/`Candidate`/`Job`/`Application`).
- `Application` has a unique constraint on `[candidateId, jobId]` — a
  candidate applies to a given job at most once, enforced at the database
  level, not just in service code.
- List endpoints are expected to use offset pagination for typical
  admin-table use (`OffsetPaginatedResult` in `@crm/types`) and cursor
  pagination for high-volume/infinite-scroll views
  (`CursorPaginatedResult`) — see [../api/conventions.md](../api/conventions.md).
  Nothing in Phase 1 loads unbounded result sets.
- Global/entity search starts as ordinary indexed PostgreSQL queries
  (`ILIKE` / trigram indexes on name/email columns as Phase 2 needs
  dictate). The architecture doesn't block adding Elasticsearch/OpenSearch
  later — search would sit behind a service-layer interface the same way
  `StorageProvider` abstracts file storage, so swapping the backing search
  engine wouldn't touch controllers.

## Dashboard & analytics numbers are never stored

Metrics like "new jobs," "placements," "shortlisted," "candidate calls" are
computed on demand from `Job`/`Application`/`Candidate`/`Activity`/
`Interview`/`Placement` rows — there is no `NewJobsTable` or
`PlacementStatsTable`. `UserEngagementEvent` is a lightweight, append-only
event log that analytics aggregation jobs (`apps/worker`) can roll up
later if computing metrics live becomes too slow at scale; it is not a
substitute for the real entities.
