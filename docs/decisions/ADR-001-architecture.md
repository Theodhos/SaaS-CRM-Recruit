# ADR-001: Phase 1 Architecture Foundation

- **Status**: Accepted
- **Date**: 2026-09-08

## Context

We're building a production-grade Recruitment CRM + ATS + Recruitment
Management Platform modeled on an existing reference CRM, targeting scale
to hundreds of thousands of candidates, thousands of jobs, many
recruiters/users, and multiple organisations (tenants) from day one. Rather
than start with a single Next.js app and a loose `/api` folder — which is
how most CRMs accumulate the specific problems this platform must avoid
(tenant leaks, hard-coded pipeline stages, N+1 dashboard queries, business
logic duplicated between frontend and backend) — this phase establishes the
full monorepo, module boundaries, database schema, and infrastructure
foundation _before_ any business functionality is implemented.

## Decisions

1. **pnpm workspaces + Turborepo monorepo**, `apps/*` (web, api, worker,
   realtime) + `packages/*` (ui, types, config, validation, database, auth,
   logger, storage, utils). Rejected: separate repos per app (too much
   cross-repo versioning overhead for a team this size building this fast),
   Nx (Turborepo's simpler task-graph model was judged sufficient for four
   apps and nine packages).

2. **NestJS for the API**, not a thinner framework (Express/Fastify
   directly) or Next.js API routes. Reasons: built-in DI makes the
   "controller → service → repository" boundary and the global guard/
   interceptor/filter pipeline (auth, tenant scoping, response envelope,
   error handling) enforceable structurally rather than by convention; a
   32-module domain (see the module list in
   [../architecture/backend.md](../architecture/backend.md)) benefits from
   Nest's module system more than it would from a flatter framework.

3. **PostgreSQL + Prisma**, single schema, `organisationId` on every
   tenant-scoped table rather than schema-per-tenant or database-per-tenant.
   See [../architecture/multi-tenancy.md](../architecture/multi-tenancy.md)
   for the full reasoning and the three-layer isolation design (TenantGuard
   → scopedPrisma → schema constraints).

4. **Candidate → Application → Job**, never a direct Candidate→Job
   relation, with organisation-configurable `Pipeline`/`PipelineStage`
   rows instead of hard-coded stage strings. This is the single most
   important modeling decision for the ATS half of the product — getting it
   wrong would block multi-job pipelines and per-org stage customization
   later. See [../database/relationships.md](../database/relationships.md).

5. **One unified `Activity` table**, not per-type tables (`Call`, `Email`,
   `Meeting`, ...). A single indexed, polymorphic-by-nullable-FK table keeps
   "everything that happened on this candidate" a single query and lets the
   frontend render one activity feed component for every entity type. The
   cost — some unused nullable FK columns per row — is judged worth the
   simplicity at this entity count.

6. **S3-compatible storage abstraction** (`packages/storage`,
   `StorageProvider` interface) rather than direct `@aws-sdk/client-s3`
   calls scattered through the API. AWS S3, Cloudflare R2, and MinIO all
   speak the S3 API, so one implementation covers all three; the interface
   boundary exists so a genuinely different provider could be swapped in
   later without touching call sites.

7. **BullMQ + Redis for background work**, run in a separate `apps/worker`
   deployable rather than in-process timers/setTimeout inside `apps/api`.
   Anything slow or best-effort (email send, CV parsing, report
   generation, imports/exports, scheduled reminders) must never block or
   risk the request-serving process.

8. **Socket.IO gateway in its own `apps/realtime` deployable**, not
   embedded in `apps/api`. A stuck or high-volume WebSocket connection
   should not be able to degrade REST latency, and the two scale
   differently (realtime connections scale with concurrent active users;
   API load scales with request volume).

9. **Auth as its own package (`packages/auth`) + module
   (`apps/api/src/modules/auth`)**, not logic embedded in `users`. See
   [../architecture/authentication.md](../architecture/authentication.md).

10. **RBAC via a global, code-defined `Permission` catalog** joined through
    org-scoped `Role`s, rather than a fixed enum of roles with hard-coded
    checks. See [../architecture/authorization.md](../architecture/authorization.md)
    — this is what lets new permissions ship without touching the
    authorization system itself.

## Consequences

- Every domain module (`apps/api/src/modules/*`) and every dashboard route
  (`apps/web/app/(dashboard)/*`) already exists as a compiling skeleton, so
  Phase 2 work is additive (fill in a module) rather than structural
  (decide where a module goes).
- The tenant-isolation and RBAC patterns are established once, centrally,
  rather than being re-derived — and potentially re-derived
  inconsistently — by whoever implements each of the 32 modules.
- The cost: nothing is demoable yet. This phase deliberately produces no
  working login, no working CRUD, no dashboard data. See the Phase 2 task
  list this ADR's authoring conversation produced (candidate/job/
  application CRUD end-to-end, real auth endpoints, RBAC seed data for
  default roles, first dashboard view) as the immediate next milestone.

## Alternatives considered and rejected

- **Start with a simpler, flatter structure and refactor into this later.**
  Rejected — multi-tenancy and RBAC are exactly the kind of concern that is
  expensive to retrofit (they touch every table and every endpoint); it's
  cheaper to establish them before the first business feature than after.
- **Monolith frontend+backend in a single Next.js app** (API routes instead
  of a separate NestJS service). Rejected — would blur the "web never
  touches Postgres directly" boundary this ADR relies on for keeping
  authorization and tenant-scoping in one enforced place, and makes
  `apps/worker`/`apps/realtime` awkward to share code with.
