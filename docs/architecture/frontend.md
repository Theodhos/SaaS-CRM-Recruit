# Frontend Architecture (apps/web)

Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, React Hook Form

- Zod, TanStack Query.

## Folder responsibilities

| Folder        | Contains                                                                                                                                              | Does NOT contain                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `app/`        | Routes only: `page.tsx`, `layout.tsx`, route groups `(auth)`/`(dashboard)`                                                                            | Business logic, reusable components                                                        |
| `components/` | Reusable, **domain-agnostic** UI: `layout`, `navigation`, `tables`, `forms`, `modals`, `dialogs`, `filters`, `search`, `charts`, `calendar`, `shared` | Anything that imports a `services/*` function or knows what a "Candidate" is               |
| `features/`   | Domain-specific composition per entity (`candidates`, `jobs`, `applications`, ...): feature components + feature-local hooks                          | Generic, reusable primitives (those belong in `components/`)                               |
| `hooks/`      | Cross-cutting or top-level React Query hooks (`use-candidates.ts`)                                                                                    | Feature-only hooks once a feature has enough of its own to warrant `features/<name>/hooks` |
| `services/`   | Thin fetch wrappers per entity, typed against `@crm/types`, calling `lib/api-client`                                                                  | React, hooks, state                                                                        |
| `stores/`     | Zustand stores for **client-only UI state** (sidebar collapse, modal open/closed)                                                                     | Server data — that's TanStack Query's job, not Zustand's                                   |
| `providers/`  | App-wide React context composition root                                                                                                               | Route-specific providers (put those in the route's own `layout.tsx`)                       |
| `lib/`        | Framework glue: `api-client.ts` (fetch wrapper unwrapping the shared `ApiResponse` envelope)                                                          | Domain logic                                                                               |
| `types/`      | Web-only types (e.g. `ClientSession`) that don't belong in the shared `@crm/types` package                                                            | Types shared with the backend — those belong in `@crm/types`                               |

**Rule of thumb:** if two different features would need the same component,
it belongs in `components/`. If it's specific to how Candidates (or Jobs, or
Applications) are displayed/edited, it belongs in `features/<name>/`.

## Why `components/` and `features/` are split

A single flat `components/` directory is the most common way a CRM frontend
becomes unmaintainable: reusable buttons/tables end up next to
one-off `CandidateStatusBadge` components, and nobody can tell what's safe
to reuse. Splitting **reusable primitives** (`components/`) from
**domain composition** (`features/`) keeps that decision explicit at the
folder level instead of relying on developer discipline.

## Data flow

```
page.tsx (Server Component, route only)
  → features/<entity>/<entity>-list.tsx (Client Component)
    → hooks/use-<entity>.ts (TanStack Query)
      → services/<entity>.service.ts (typed fetch)
        → lib/api-client.ts (envelope unwrap, error → ApiClientError)
          → apps/api REST endpoint
```

Server state (anything from the API) lives in TanStack Query, never in
Zustand or component state beyond local UI concerns. This avoids the classic
"two sources of truth" bug class (stale Zustand copy vs. fresh server data).

## Auth on the frontend

`middleware.ts` only checks for the **presence** of a session cookie and
redirects between the `(auth)` and `(dashboard)` route groups — it does not
validate the token (that's `apps/api`'s job on every request). See
[authentication.md](./authentication.md).

## Styling

`packages/ui` owns the Tailwind theme tokens and shadcn/ui primitives
(`Button`, and siblings added as needed). `apps/web/app/globals.css` imports
`@crm/ui/styles.css` rather than redefining tokens, so there is exactly one
design-token source even if a second frontend app is added later.
