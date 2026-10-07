# Redis: cache, rate limits, locks and queues

Redis is used for four different jobs with **different failure requirements**, so they do not share one instance or one
client.

| Job | Instance | Eviction | Client behaviour when Redis is down |
| --- | --- | --- | --- |
| BullMQ job queues | `redis` | **`noeviction`** + AOF | waits and retries — a lost job is a lost e-mail/import |
| Cache-aside for dashboards | `redis-cache` | `allkeys-lru`, no persistence | **fail-open**: run the query as if there were no cache |
| Rate-limit counters | `redis-cache` | LRU (losing a counter only resets a window) | falls back to per-process counting |
| Scheduler locks | `redis-cache` | LRU (a lost lock only allows one duplicate tick) | runs the sweep anyway |

BullMQ prints `IMPORTANT! Eviction policy is allkeys-lru. It should be "noeviction"` if you point it at the cache
instance — that is exactly the misconfiguration this split prevents.

Everything is **opt-in** and off by default, so a plain `pnpm dev` (no Redis) behaves exactly as before:

| Variable | Effect |
| --- | --- |
| `CACHE_ENABLED=true` | cache-aside for `analytics/overview`, `analytics/dashboard-summary`, `reports/overview` |
| `THROTTLER_STORAGE=redis` | one shared rate limit across all API replicas |
| `SCHEDULER_LOCK=redis` | each `@Cron` sweep runs on one replica per tick |
| `HEALTH_REQUIRE_REDIS=true` | `/health/ready` also requires Redis |
| `REDIS_CACHE_URL` | cache instance (defaults to `REDIS_URL`) |

When none of these is set the API opens **no** Redis connection for them.

## How the cache stays correct

A cache hit must be indistinguishable from a fresh read, so the design is about *invalidation*, not TTL luck:

1. **Tenant-scoped keys**: `tenant:{organisationId}:v{version}:{name}`. The organisation id is the validated token's,
   never a request parameter.
2. **Versioned invalidation**: `tenant:{organisationId}:ver` is bumped (`INCR`) after **every mutating request** of that
   tenant — success *or* failure (a failed write may have partly applied). Bumping orphans every cached value of the
   tenant at once; orphans expire by TTL. The bump is awaited before the response is released, so a client always reads
   its own writes — even when the read is served by a different replica (verified: write on replica 1, read on replica 2).
3. **No stale write-back**: the version is captured *before* the loader runs. A value computed from data that a concurrent
   write has since changed is stored under the old version and is never served.
4. **Bounded staleness** for writes that bypass the API (manual SQL, other systems): `CACHE_TTL_SECONDS` (default 30).
5. **Stampede protection**: concurrent misses collapse into one computation in-process (single-flight) and across replicas
   (a short `SET NX` lock; waiters poll briefly, then compute themselves rather than block).
6. **Fail-open + circuit breaker**: every Redis call has a 200 ms timeout and no offline queue. After 3 consecutive errors
   the cache is bypassed for 10 s, so a dead Redis never adds latency. Verified by killing Redis under a running API:
   responses stayed identical to the uncached baseline with no extra latency, and the replicas reconnected by themselves.
7. **Bounded size**: values above `CACHE_MAX_VALUE_BYTES` (1 MB) are returned but not stored.

What is deliberately **not** cached: lists (they change on every write and are already index-bound), anything per-user,
permissions/roles (they travel inside the JWT; caching them would change revocation semantics), and mutations.

## Metrics

`crm_cache_requests_total{name,result}` (`hit|miss|bypass|error`) — alert if the hit ratio stays low (TTL too short, or
tenants writing constantly) — plus Redis' own `redis_*` series from the exporters (memory, evictions, latency).
