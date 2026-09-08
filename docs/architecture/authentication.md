# Authentication

Authentication lives entirely in `packages/auth` + `apps/api/src/modules/auth`
— it is never re-implemented or partially duplicated inside another module.

## Why a separate package (not just a NestJS module)

`packages/auth` holds the pieces that are conceptually "platform", not
"business": the `JwtStrategy`, `JwtAuthGuard`, `PermissionsGuard`,
`@CurrentUser()`/`@CurrentTenant()`/`@Public()`/`@Permissions()` decorators,
and the `TokenPayload`/`TenantContext` types. `apps/api/src/modules/auth`
then wires those primitives with NestJS DI (`JwtModule.registerAsync`,
`PassportModule`) and owns the actual login/register/refresh/logout
endpoints. Both `apps/realtime` (WebSocket handshake auth) and, in
principle, any future Nest app can depend on `packages/auth` without
depending on the whole `apps/api` module tree.

## Token model

- **Access token** (JWT, short-lived — `JWT_ACCESS_EXPIRES_IN`, default
  15m): carries `TokenPayload` — `sub` (userId), `organisationId`, `email`,
  `role` (singular — see [authorization.md](./authorization.md)),
  `permissions`. Stateless; every request re-verifies the signature, never
  re-queries the DB for authorization data mid-request.
- **Refresh token** (longer-lived — `JWT_REFRESH_EXPIRES_IN`, default 7d):
  used only to mint a new access token.
- Session/cookie transport: the frontend never reads the JWT directly — see
  `apps/web/middleware.ts`, which only checks for a session cookie's
  _presence_ and defers validation entirely to `apps/api`.

Permissions are embedded in the access token at issue time (resolved from
the user's single role → `RolePermission` → `Permission`), not re-joined
per request, to keep the common-case request path DB-query-free for
authorization. A role change takes effect on next token refresh — acceptable
for a 15-minute access token lifetime; revisit if that latency becomes a
problem.

## Request-time flow

1. `JwtAuthGuard` (`packages/auth`) verifies the signature/expiry and
   attaches the decoded `TokenPayload` to `request.user`. Routes marked
   `@Public()` skip this (login, register, refresh, `/health`).
2. `TenantGuard` (`apps/api/src/common/guards`) refuses to proceed if
   `organisationId` is missing, then publishes a `TenantContext` on
   `request.tenant` — this is what every service/repository must use, never
   a client-supplied organisation id. See
   [multi-tenancy.md](./multi-tenancy.md).
3. `RolesGuard`/`PermissionsGuard` enforce `@Roles()`/`@Permissions()`
   metadata declared on the handler. See [authorization.md](./authorization.md).

## Passwords

`bcrypt` (`PASSWORD_SALT_ROUNDS`, default 12) — hashing happens in
`modules/auth`'s service layer, never in a DTO, controller, or the frontend.

## What's a skeleton vs. real in Phase 1

`JwtStrategy`, the guard chain, and the `AuthModule`'s DI wiring
(`JwtModule.registerAsync`, `PassportModule`) are real and functional. The
actual `login`/`register`/`refresh`/`logout` handler bodies in
`modules/auth/controller/auth.controller.ts` are Phase 2 — implementing them
is the first task once business functionality work begins, since every
other module's guards depend on a working token issuer to test against.
