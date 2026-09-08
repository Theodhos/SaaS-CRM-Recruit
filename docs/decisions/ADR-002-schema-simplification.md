# ADR-002: Entity Simplification, Single-Role RBAC, Real Seed Data

- **Status**: Accepted
- **Date**: 2026-09-08
- **Supersedes**: field-level decisions in [ADR-001](./ADR-001-architecture.md); does not change the module/monorepo/multi-tenancy architecture it established.

## Context

ADR-001 established the monorepo, module boundaries, and a Prisma schema
with 41 models. A follow-up specification tightened the entity model
considerably: fewer fields per entity ("what is the minimum information
required to identify and operate this object?"), a simpler RBAC shape, and
an explicit instruction to seed real, minimal, relationally-complete
development data rather than leaving the database empty. This ADR records
what changed and why.

## Decisions

1. **Every entity was cut down to its minimum viable field set.**
   `Candidate` dropped `salaryExpectation`, `availability`, `linkedinUrl`,
   `summary`; `Company` dropped the four-line address breakdown, `size`,
   `description`; `Fee` dropped `type`/`percentage`/`invoicedAt`;
   `Placement` dropped `salary`/`currency`/`applicationId`; `Interview`
   dropped its `type` enum and multi-interviewer join table in favor of a
   single `interviewerId`. None of these were wrong, exactly — they were
   premature. Adding a field back when a real requirement appears is a
   one-line migration; carrying fields nobody uses is a standing
   maintenance cost with no offsetting benefit at this stage.

2. **`JobRequirement` and `InterviewParticipant` were removed entirely.**
   Job requirements can live in the free-text `description` field until
   structured requirements are an actual product requirement.
   Multi-interviewer scheduling is real but not yet needed — a single
   `interviewerId` covers the common case, and promoting it to a join
   table later doesn't touch anything else.

3. **`Comment` and `Document` moved from polymorphic
   `(entityType, entityId)` to explicit nullable foreign keys** (matching
   the pattern `Activity`/`Task`/`CalendarEvent` already used). This
   restores real referential integrity — the database can no longer
   contain a comment pointing at a candidate that doesn't exist — at the
   cost of a handful of always-null columns per row, which is a good
   trade at this entity count. `Tag`/`CandidateTag` is the one deliberate
   exception left, documented in
   [docs/database/relationships.md](../database/relationships.md#the-one-deliberate-exception-tagcandidatetag).

4. **`Application` now owns `pipelineId` directly**, rather than resolving
   the pipeline through `Job.pipelineId`. `Job` no longer references a
   pipeline at all. This decouples "which pipeline is this job's default"
   from "which pipeline is this specific application being tracked
   through" — a distinction the previous schema couldn't express.

5. **RBAC simplified from many-to-many (`UserRole` join table) to a single
   required `User.roleId`.** One user, one role. This is a real capability
   reduction (a user can no longer hold two roles simultaneously) accepted
   deliberately because it matches how recruitment CRM roles are actually
   assigned in practice, and because "promote a single FK to a join table"
   is a contained migration if a genuine multi-role need ever appears —
   there was no reason to pay the complexity cost of the general case
   upfront. See [docs/architecture/authorization.md](../architecture/authorization.md).

6. **The seed script now creates real, minimal, relationally-complete dev
   data**, not just the permission catalog. `packages/database/prisma/seed/dev-fixtures.ts`
   creates exactly one of each: organisation, admin user, recruiter user,
   company, contact, candidate, job, pipeline (with 7 stages), application,
   and two activities (one candidate-facing, one contact-facing) — enough
   to prove every relationship in the schema resolves correctly, gated to
   never run in production. This directly answers the "no fake data"
   principle: the fixtures aren't UI-facing demo content, they're a
   correctness check that the graph of foreign keys actually holds
   together, run once via `pnpm db:seed`.

## Consequences

- The schema shrank from 41 to 38 models; every model that remains has a
  field list traceable to an actual stated requirement.
- `packages/auth`'s `TokenPayload`/`TenantContext` changed shape
  (`roles: string[]` → `role: string`), which rippled into
  `apps/api/src/common/guards/{roles,tenant}.guard.ts`. This was the only
  cross-cutting code change required — every domain module skeleton
  (`apps/api/src/modules/*`) was unaffected, because those skeletons never
  referenced specific Prisma fields to begin with.
- `prisma generate` and a full monorepo `type-check`/`lint` were run after
  every schema edit in this pass and are clean. The schema was **not**
  validated against a running PostgreSQL instance — this development
  environment has neither Docker nor a local Postgres install available.
  Running `docker compose up -d postgres && pnpm db:migrate && pnpm db:seed`
  against a real database is the first concrete Phase 2 action.

## Alternatives considered and rejected

- **Keep the many-to-many `UserRole` join and just simplify other fields.**
  Rejected — the specification explicitly asked for simple RBAC, and a
  single FK is measurably simpler to build UI and queries against than a
  set; nothing in the reference product's scope needs a user to hold
  multiple roles.
- **Keep `Document`/`Comment` polymorphic for consistency with the original
  design.** Rejected once the spec's own field lists for `Comment` showed
  explicit per-entity nullable FKs — matching that pattern for `Document`
  too was the more consistent choice, and better for data integrity.
