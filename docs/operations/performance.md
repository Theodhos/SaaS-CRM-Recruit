# Performance: what was measured, what changed, what is left

Everything below was **measured**, not estimated. Where a number is a single run or the noise is large, it says so.
Reproduce with [`infrastructure/loadtest`](../../infrastructure/loadtest/README.md).

## Method (and its limits)

* **Dataset** (synthetic, one big tenant + one small): 1,000,000 candidates (921,500 live; ~307k with no application),
  800k applications, 2M activities, 2M audit-log rows, 1M notifications, 500k tasks, 200k contacts, 100k jobs, 50k companies.
  PostgreSQL 16.14, `VACUUM ANALYZE`d (autovacuum would do it in production).
* **Where**: API and database on one Windows dev machine, so network round-trip is ~0 and the numbers are pure database + application
  cost. **Production adds the network round-trip per SQL statement** (measured ~54 ms to the current Supabase pooler), so the
  *statement counts* below matter more there than the milliseconds.
* **A/B protocol**: two API builds run side by side against the same database; requests alternate A,B,B,A,... (10 rounds after 2
  warm-ups) and **every response body is compared for equality**. Sequential before/after runs were tried first and discarded: they
  moved +-40% on endpoints nobody had touched. With interleaving, untouched endpoints land at x0.9-1.1, which is the noise floor:
  ignore differences inside it.
* **Equivalence**: 35 read endpoints x 3 comparisons (with/without indexes; old/new code; old code/new code with Redis). **Every
  response was byte-identical** (ignoring `requestId`).
* **Not measured**: a real production network, real-user browsers (Web Vitals reporting is now in place to collect them), 5M+ rows
  (1M was the largest practical size on this machine — the plans scale roughly linearly, see "Growing").

## 1. What changed, and what it bought

### A. Indexes (database only — the code was identical for this comparison)

Same API build (`dist-baseline`) against the database **without** vs **with** the nine new indexes, p50 in ms:

| Endpoint | without | with | | Endpoint | without | with |
| --- | ---: | ---: | --- | --- | ---: | ---: |
| `GET /notifications/unread-count` (polled every 30 s per open tab) | 146 | **9** | | `GET /candidates` | 409 | **271** |
| `GET /notifications` | 120 | **28** | | `GET /candidates?status=ACTIVE` | 448 | **324** |
| `GET /tasks` | 165 | **39** | | `GET /candidates?unassigned=true` | 958 | **776** |
| `GET /jobs` | 59 | **38** | | `GET /candidates?hasApplications=true` | 961 | **825** |
| `GET /applications` | 257 | **205** | | untouched endpoints (`/users`, `/roles`, `/auth/me`, `/search`, `/audit-logs` ...) | — | x0.93-1.2 (noise) |

What is left in the candidate/application numbers is the `COUNT(*)` for "total pages", which no index can make O(1) (next section).
At query level (EXPLAIN ANALYZE on the real SQL Prisma issues) the *list* queries themselves went from **473-829 ms to ~0 ms**
(candidates, applications 691 -> 0, tasks 413 -> 0, notifications 179 -> 0, contacts 100 -> 0, jobs 67 -> 0.2, hasApplications
list 718 -> 0, unassigned list 582 -> 205) because PostgreSQL now walks the index in `ORDER BY` order and stops after `LIMIT`.

**Index report** (`packages/database/prisma/migrations/20260925130000_perf_indexes`, all declared in `schema.prisma`, `IF NOT EXISTS`):

| Index | Serves | Size at 1M rows | Build |
| --- | --- | ---: | ---: |
| `candidates (organisationId, createdAt DESC)` | default list, search, `unassigned`, `hasApplications` | 56 MB | 0.9 s |
| `candidates (organisationId, status, createdAt DESC)` | status-filtered list (rare statuses) | 56 MB | 1.3 s |
| `applications (organisationId, appliedAt DESC)` | applications list | 45 MB | 0.7 s |
| `tasks (organisationId, dueDate, createdAt DESC)` | tasks list | 32 MB | 0.6 s |
| `notifications (userId, organisationId, createdAt DESC)` | bell list | 88 MB | 1.9 s |
| `notifications (userId, organisationId, readAt)` | unread badge, index-only | 8 MB | 1.5 s |
| `contacts (organisationId, createdAt DESC)` | contacts list | 11 MB | 0.3 s |
| `jobs (organisationId, createdAt DESC)` | jobs list | 5.8 MB | 0.2 s |
| `users (email)` | login (looks up by e-mail alone) | small | — |

Indexes that were tried **and rejected**: a `companies (organisationId, createdAt)` index made the company search *slower*
(224 -> 441 ms; the planner walked it instead of hash-joining the `_count` aggregates); a *partial* candidates index is unnecessary (the
plain composite performs the same and Prisma can declare it, so `prisma migrate dev` never treats it as drift). One index looked
like a regression (`unassigned` 1044 -> 1639 ms) until the plan showed `actual rows=0`: the synthetic data had no unassigned
candidates, so the ordered walk scanned everything. **Lesson: judge plans on realistic data distributions.** With ~1/3 unassigned it
is 582 -> 205 ms.

Write cost: each index adds one B-tree insert per row written. These tables are read-mostly and the columns are immutable
(`organisationId`, `createdAt`), so writes stay HOT-eligible.

### B. Code changes (same database, Redis features off)

| Change | Effect | Proof |
| --- | --- | --- |
| `unassigned` candidate pool skips a `COUNT` whose result was discarded | statements 5 -> 4; **p50 598 -> 310 ms (x0.52)** | interleaved A/B; response identical |
| `analytics/overview`: three counts derived from `groupBy`s already in the same batch | statements 16 -> 14; p50 1070 -> 893 ms (x0.83) | same |
| `placementStartDates` bounded to the 6 months the chart shows (and its useless `ORDER BY` dropped) | fewer rows transferred (identical chart) | same window as `bucketDatesByMonth` |
| register: 46 nested `INSERT`s -> one `createMany` | ~45 fewer round trips (~2.5 s at 54 ms RTT) | new-org admin receives all 46 permissions |
| everything else | x0.9-1.1 (noise) | — |

**An experiment that was reverted** (recorded so nobody repeats it): `reports/overview` runs five whole-table `application` scans
in parallel. Merging them into one scan cut peak memory (3.0 -> 1.5-2.3 GB) but made a single request *slower* (14-17 s -> 23-28 s,
because the five scans had been decoded on separate connections/threads), and with three concurrent requests wall time was
identical (41.1 s vs 40.7 s) and memory only 15% lower (5.7 -> 4.8 GB). No measurable win, so the original code was restored. The
report is still O(rows-in-memory): see "Remaining bottlenecks".

### C. Redis cache (opt-in) — **best case, read-mostly tenant**

Hits on a warm cache, p50 in ms, baseline code vs new build with `CACHE_ENABLED=true` (identical bodies):

| Endpoint | baseline | cached | | Endpoint | baseline | cached |
| --- | ---: | ---: | --- | --- | ---: | ---: |
| `GET /analytics/overview` | 1065 | **3** | | `GET /candidates` | 153 | **6** |
| `GET /analytics/dashboard-summary` | 306 | **2** | | `GET /candidates?hasApplications=true` | 799 | **8** |
| `GET /applications` | 170 | **9** | | `GET /contacts` | 65 | **7** |

Read this honestly: those are *hits*. Every write by a tenant invalidates that tenant's cache, so a tenant that writes constantly sees
mostly misses (the first list load after a write pays the `COUNT` again: 150-450 ms at 1M candidates). The cache changes how often you pay
for expensive reads; it does not make them cheaper. Lists themselves (the rows) are never cached — only the totals and the dashboard
aggregates — so results stay exact.

### D. What did not change

`activities` (150 ms), `audit-logs` (290-420 ms), `applications` misses and the `unassigned` list (300-450 ms) are still dominated by
`COUNT(*)`/anti-joins over 0.8-2M rows. Audit-log and activity totals are deliberately **not** cached (background jobs also write them,
so a cached total could be stale); they need a different fix (below).

## 2. Load test (concurrent users)

30 virtual users, closed loop with no think time (the worst case for the server), a weighted read mix (candidate/application/job/
task lists, dashboard, unread badge, search), one API process, both builds on the **indexed** database (so this isolates the code
and Redis changes; the index effect is in section 1A). Zero errors in every run.

| Scenario | Build | Throughput | p50 | p95 | p99 |
| --- | --- | ---: | ---: | ---: | ---: |
| Read-only, 60 s | baseline | 17 req/s | 1492 ms | 4142 ms | 4699 ms |
| Read-only, 60 s | new + Redis cache/limiter | **274 req/s** | **87 ms** | **322 ms** | **475 ms** |
| **10 % writes**, 45 s (each write invalidates the tenant's cache) | baseline | 19 req/s | 1268 ms | 3367 ms | 3782 ms |
| **10 % writes**, 45 s | new + Redis | **44 req/s** | **555 ms** | **1991 ms** | **2423 ms** |

The read-only line is the cache's best case (nothing ever invalidates it). The 10 %-writes line is the honest one for a busy tenant:
about 2.3x the throughput and roughly half the tail latency, not 16x. Memory stayed flat (about 420-500 MB per API process).
`POST /candidates` p50 fell from 2762 to 913 ms under that load because the writes no longer queue behind whole-table `COUNT`s.

## 3. `reports/overview` — memory, not just time

Fresh process per variant, 800k applications. Original code: **14-17 s and 2.9-3.1 GB** peak RSS for one request; **41 s and 5.7 GB**
for three at once. (At 1.2M applications a single request reached 28 s and 4.1 GB — close to Node's default heap limit.) With
`CACHE_ENABLED=true` the first request still costs the same (22 s) and every following request until the tenant writes costs
**0 ms**. The computation itself is unchanged (see the reverted experiment in 1B). This endpoint is the single largest scaling risk
in the application: it reads every application of a tenant into the Node heap.

## 4. Remaining bottlenecks, ranked

| # | Bottleneck | Measured | Fix, and what it needs from you |
| --- | --- | --- | --- |
| 1 | `reports/overview` loads every application into memory | 14-28 s, 3-4 GB per request | Aggregate in PostgreSQL (`GROUP BY source,status / owner / job / month`). The result is identical **except the order of groups with equal counts**, which today depends on physical row order and is undefined — so it needs your explicit OK before I change it |
| 2 | `COUNT(*)` for "total pages" is O(rows) | 150-450 ms at 1M; audit-logs 290-420 ms at 2M | cached for six entities; audit/activity totals are written by background jobs too, so they need counters or approximate totals (a UX decision), or keyset pagination without totals |
| 3 | `unassigned` pool: Prisma emits `NOT IN (SELECT candidateId ...)` over every application | 310-450 ms | a `NOT EXISTS` rewrite needs raw SQL (bypasses the ORM's tenant scoping — review first) |
| 4 | Company list: Prisma's `_count` aggregates scan whole child tables | 150-370 ms at 1M candidates | fetch counts for the 20 visible companies only; **not** provably identical (Prisma's `_count` is unscoped, `scopedPrisma` would scope it) |
| 5 | `OFFSET` pagination | O(offset) | keyset/cursor pagination changes the API contract and the pager UI — your call |
| 6 | `ILIKE '%term%'` search | ~250-300 ms for rare terms at 1M | `pg_trgm` GIN indexes on 6 columns per entity (large; slows writes) — measure against your real search terms first |
| 7 | Every Prisma `include` is a separate round trip | 5-7 statements per list (about 54 ms each on Supabase) | `relationLoadStrategy: 'join'` (preview feature in Prisma 5.22) — needs a client regeneration and verification |
| 8 | CV parsing (`pdf-parse`, `mammoth`) runs on the API event loop | up to 10 MB per upload | worker thread or queue + wait; keeps the synchronous contract the form relies on |
| 9 | Missing FK indexes: `tasks/documents/comments/calendar_events.applicationId` | deleting applications scanned `tasks` (a 400k-row delete ran > 10 min until RI triggers were disabled) | plain `CREATE INDEX CONCURRENTLY` on the sparse columns; only matters for hard deletes and detail-page filters |

Not done on purpose: virtualised tables (pages are 20 rows, so there is nothing to virtualise), request debouncing on the ten search
boxes (a visible change to when results appear), optimistic updates (a UX change), and moving reminder sweeps to the worker (it has no
database access yet).

## 5. Growing to 5M-10M rows (extrapolation, **not measured**)

List pages stay ~0 ms (index walk + `LIMIT`). `COUNT(*)` grows linearly (about 1.2 s at 5M) so the count cache (or a count strategy from
row 2) becomes mandatory. `reports/overview` at 5M applications would need ~20 GB of heap — it **will** crash the process, so row 1 must be done
before a tenant approaches ~1M applications. Everything else scales with the index size (a few hundred MB per index at 5M).

## 6. Findings outside performance (reported, not changed)

* `applications` create/update never verifies that `pipelineId`, `pipelineStageId`, `ownerId` (and on update `candidateId`/`jobId`) belong to the caller's
  organisation, and the same holds for `ownerId`, `interestedJobId`, `assignedToId`, `userId`, `companyId` on other create DTOs. Combined with
  unscoped nested includes this allows cross-tenant foreign-key injection. `analytics.repository.ts` reads `pipelineStage` for all tenants.
* `storage.controller.ts`: an `orgId/../..` key passes its `startsWith` check (path traversal).
* **Fixed here:** the httpOnly `crm_session`/`crm_refresh` cookies were written to the access logs (only `Authorization` was redacted); `worker` and
  `realtime` could not start from their built output (`@crm/*` shipped as raw TypeScript); `realtime`/`api` were missing `zod` and the AWS SDK as
  declared dependencies; the compose file mapped the API to the wrong port; `next build` failed on Windows.
