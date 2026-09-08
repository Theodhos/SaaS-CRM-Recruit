# Multi-Tenancy

`Organisation` is the tenant boundary. This is the single most important
constraint in the codebase — a leak here is a customer-data breach, not a
bug. Isolation is enforced at **three independent layers**; any one of them
failing must not be sufficient to leak data.

## Layer 1 — Identity: TenantContext

`TenantGuard` (`apps/api/src/common/guards/tenant.guard.ts`) runs on every
authenticated request, reads `organisationId` out of the _verified_ JWT
(never a client-supplied header/body/query param), and publishes it as
`request.tenant: TenantContext`. Every controller that needs the tenant
pulls it via `@CurrentTenant()` (`packages/auth`) — there is no other
sanctioned way for a handler to learn "which organisation is this?".

## Layer 2 — Data access: scopedPrisma()

`packages/database/src/tenant.ts` exports `scopedPrisma(client,
organisationId)`, a Prisma Client Extension that transparently injects
`organisationId` into the `where`/`data` of every operation
(`findMany`, `update`, `create`, `delete`, `upsert`, ...) against the models
listed in `TENANT_SCOPED_MODELS`. Every module's `repositories/*` must
obtain its client via `DatabaseService.forTenant(organisationId)`
(`apps/api/src/infrastructure/database/database.service.ts`) —
**repositories must never import the raw `prisma` singleton directly** for
a tenant-scoped model. This is the layer that actually prevents a query
bug from crossing tenants, even if a guard is accidentally skipped.

## Layer 3 — Schema: organisationId columns + indexes

Every tenant-scoped table in `packages/database/prisma/schema.prisma`
carries `organisationId` with `onDelete: Cascade` back to `Organisation`,
plus an index (at minimum `@@index([organisationId])`, often a compound
index for common filters like `[organisationId, status]`). This is what
makes Layer 2's generated `WHERE organisationId = ?` cheap at hundreds of
thousands of rows, and what makes "delete this tenant's data" a single
cascading operation rather than a manual sweep across 30 tables.

## Explicit non-goals for Phase 1

- **Frontend filtering is never a security boundary.** `apps/web` trusts
  whatever `apps/api` returns; it does no client-side tenant filtering.
- Row-Level Security (Postgres RLS) was considered and deferred — the
  three-layer application-level approach above is the Phase 1 design.
  Revisit RLS as defense-in-depth once the schema and access patterns are
  stable; retrofitting RLS onto a schema this size later is a mechanical
  (if tedious) migration, not a redesign.
- Schema-per-tenant / database-per-tenant was rejected for this scale target
  (hundreds of thousands of candidates across many orgs, not a handful of
  huge enterprise tenants) — a single schema with `organisationId` and good
  indexing is simpler to operate and migrate, and Postgres partitioning by
  `organisationId` remains available later if a single tenant outgrows
  shared tables.

## Adding a new tenant-scoped model — checklist

1. Add `organisationId String` + the `Organisation` relation (`onDelete:
Cascade`) + `@@index([organisationId])` in `schema.prisma`.
2. Add the Prisma model's camelCase name to `TENANT_SCOPED_MODELS`
   (`packages/database/src/tenant.ts`).
3. Access it only through a module's `repositories/*` via
   `db.forTenant(organisationId)` — never the raw client.
