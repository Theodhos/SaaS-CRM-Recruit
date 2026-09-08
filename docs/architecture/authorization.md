# Authorization (RBAC)

## Model

```
User ──(roleId, single FK)──> Role ──< RolePermission >── Permission
User ──< TeamMember >── Team
```

- **Permission**: a global, code-defined capability catalog (`candidate:create`,
  `job:read`, `reports:view`, ...). Not organisation-scoped — new
  permissions ship via a migration + seed entry
  (`packages/database/prisma/seed/permissions.ts`), never hand-created per
  tenant. Naming convention: `<module>:<action>`
  (`create`/`read`/`update`/`delete`, or a bespoke verb like `reports:view`).
- **Role**: organisation-scoped, a named bundle of permissions (`Admin`,
  `Recruiter`, `Manager`, `Consultant`, `Viewer`, ...). Organisations define
  their own roles; the permission catalog itself is fixed by the codebase.
- **User → Role is a single required foreign key** (`User.roleId`) — every
  user has exactly one role, not several. This is a deliberate
  simplification over a many-to-many `UserRole` join: most recruitment CRM
  usage genuinely fits "this person is a Recruiter" as a single fact, and a
  single FK is simpler to reason about, simpler to display in the UI ("your
  role: Recruiter"), and simpler to query ("all Recruiters") than resolving
  a set. If a real multi-role requirement shows up later, promoting
  `roleId` to a join table is a contained migration, not a redesign.
- **Team**/`TeamMember` is a separate grouping concern (who reports to
  whom, shared pipelines/dashboards) — not itself a permission boundary.
  Don't encode authorization rules on team membership; use role/permissions
  for that.

## Why this scales without rewriting the authorization system

Adding a new permission is: add one row to the `Permission` seed list, wrap
the relevant handler in `@Permissions('newmodule:action')`. No enum to
extend in application code, no guard logic to touch —
`apps/api/src/common/constants/permissions.constants.ts` is a
compile-time-checked mirror of the seed data purely so
`@Permissions(PERMISSIONS.CANDIDATE.CREATE)` catches typos at build time; the
runtime authority is always the database.

## Enforcement points

1. `@Permissions('candidate:create')` on a controller handler (fine-grained,
   preferred for almost everything) — enforced by `PermissionsGuard`
   (`packages/auth`).
2. `@Roles('ADMIN')` (coarse-grained, structural gates only — e.g. "only
   admins can access `/settings`") — enforced by `RolesGuard`
   (`apps/api/src/common/guards`), checked against the single `role` claim.
3. `@Public()` explicitly opts a route OUT of authentication entirely
   (login, health check) — never used to skip _authorization_ on an
   otherwise-authenticated route.

Both the role and the resolved permission set are read from the
already-verified JWT (`request.user`), not re-queried from the database per
request — see [authentication.md](./authentication.md) for why, and the
tradeoff that implies (a role/permission change applies on next token
refresh, not instantly).

## What Phase 1 establishes vs. defers

The schema (`Role`/`Permission`/`RolePermission`/`User.roleId`), the guard
chain, the decorators, and the seeded permission catalog are real, and the
dev seed (`packages/database/prisma/seed/dev-fixtures.ts`) creates a
working `Admin` role (all permissions) and `Recruiter` role (everything
except `settings:manage`/`users:manage`) to prove it. Actual role
management endpoints (`modules/roles`, `modules/permissions`) — creating,
renaming, and reassigning roles through the UI — are Phase 2.
