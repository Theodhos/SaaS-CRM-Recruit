# API Conventions

## Versioning

Every route lives under `/api/v1/...` (`API_GLOBAL_PREFIX`,
`app.setGlobalPrefix()` in `apps/api/src/main.ts`), except `/health`, which
is explicitly excluded so infra/load-balancer probes don't depend on the
API version. Breaking changes get a new prefix (`/api/v2`) — existing
consumers of `v1` must keep working until they're migrated, not broken by a
same-version change.

## Response envelope

Every response — success or error — is one of the two shapes in
`@crm/types`:

```ts
// Success
{ success: true, data: T, meta?: {...}, requestId: string }

// Error
{ success: false, error: { code: string, message: string, details?: unknown }, requestId: string }
```

Produced automatically:

- `ResponseEnvelopeInterceptor` wraps every non-error controller return
  value.
- `HttpExceptionFilter` catches everything (a thrown `HttpException`/
  `AppException` subclass, or any other error) and produces the error
  shape — clients never see a bare, unwrapped JSON body or an HTML error
  page.

`requestId` (set by `RequestIdInterceptor`, also echoed as the
`X-Request-Id` response header) is the correlation key between a client bug
report, API logs, and downstream worker/realtime logs. Prefer throwing an
`AppException` subclass (`apps/api/src/common/exceptions/app.exception.ts`)
over a bare `Error` when a handler needs a specific `code` in the response.

## Pagination

Two supported shapes, both in `@crm/types` and `@crm/validation`:

- **Offset** (`OffsetPaginationParams` → `OffsetPaginatedResult<T>`):
  `?page=1&pageSize=25`. Default for admin-style tables (candidate list,
  job list) where "go to page N" and total counts matter.
- **Cursor** (`CursorPaginationParams` → `CursorPaginatedResult<T>`):
  `?cursor=...&limit=25`. Use for high-volume or infinite-scroll views
  (activity feeds, audit logs) where offset pagination's `COUNT(*)` cost
  and page-drift-under-writes become real problems.

No endpoint returns an unbounded list. `pageSize`/`limit` are capped
(`max(100)` in the shared Zod schemas) even if a client requests more.

## Sorting & filtering

Server-side only (`SortParam` in `@crm/types`: `{ field, direction }`).
Filtering criteria are endpoint-specific query params, validated the same
way as any other input — see below. The frontend never fetches an entire
table and filters/sorts client-side.

## Validation

- **Web**: `react-hook-form` + `@hookform/resolvers/zod`, schemas from
  `@crm/validation`.
- **API**: `ValidationPipe` (global, `whitelist: true`,
  `forbidNonWhitelisted: true`, `transform: true`) with `class-validator`/
  `class-transformer` DTOs in each module's `dto/`.
- Sharing the exact same Zod schema between web and api is a Phase 2
  convenience goal (a class-validator ↔ Zod bridge), not a Phase 1
  requirement — `@crm/validation`'s schemas are usable directly on the
  frontend today; wiring them into NestJS DTOs is deferred so Phase 1 stays
  schema-only.
- **Client input is never trusted as the sole validation.** Any rule
  enforceable server-side (uniqueness, referential integrity, tenant
  ownership) is enforced in `apps/api`, regardless of what the frontend
  already checked.

## Authentication & authorization on every route

See [../architecture/authentication.md](../architecture/authentication.md)
and [../architecture/authorization.md](../architecture/authorization.md).
In short: authenticated and tenant-scoped by default; opt out explicitly
with `@Public()`, opt into fine-grained checks with `@Permissions(...)`.

## OpenAPI / Swagger

`@nestjs/swagger` generates a live spec at `/api/v1/docs`, non-production
only (`main.ts`). DTOs should carry `@ApiProperty()` decorators as they're
implemented in Phase 2 so the generated spec stays accurate — this is the
canonical API reference, not a hand-maintained doc.
