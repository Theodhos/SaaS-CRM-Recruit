import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import type Redis from 'ioredis';

import { getRecordOwnerScope } from '../../common/context/request-context';
import { MetricsService } from '../metrics/metrics.service';

import { CACHE_REDIS } from './cache-redis.provider';
import { envInt } from './env';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Release the lock only if it is still ours (a slow loader may outlive its lock).
const RELEASE_LOCK = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;

/**
 * Tenant-aware cache-aside for expensive, read-mostly aggregates (dashboard / reports).
 *
 * Correctness rules — the point of this class is that a cache hit is indistinguishable from a fresh read:
 *
 *  1. TENANT ISOLATION. Every key is `tenant:{organisationId}:...`; the organisation id always comes from the
 *     validated request context (never from client input), so one tenant can never read another's entry.
 *  2. DETERMINISTIC INVALIDATION. Keys embed a per-tenant version (`tenant:{id}:ver`). Any mutating request by
 *     that tenant bumps the version (see TenantCacheInvalidationInterceptor), which orphans every cached
 *     value for the tenant at once. Orphaned keys expire by TTL. The version is captured BEFORE the loader
 *     runs, so a value computed from data that a concurrent write has since changed is stored under the old
 *     version and is never served again.
 *  3. BOUNDED STALENESS for writes that bypass the API (manual SQL, other systems): the TTL.
 *  4. FAIL-OPEN. Any Redis error, a disabled cache, an oversized value, or an open circuit breaker simply runs
 *     the loader — behaviour is then exactly what it is without a cache.
 *  5. STAMPEDE PROTECTION. Concurrent misses for one key are collapsed in-process (single-flight) and across
 *     instances (a short `SET NX` lock; waiters poll briefly, then compute themselves rather than block).
 *
 * Off by default: enable with CACHE_ENABLED=true (requires Redis; see docs/operations/caching.md).
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly inflight = new Map<string, Promise<unknown>>();

  private readonly maxValueBytes = envInt('CACHE_MAX_VALUE_BYTES', 1_000_000);
  private readonly lockTtlMs = envInt('CACHE_LOCK_TTL_MS', 15_000);
  private readonly lockWaitMs = envInt('CACHE_LOCK_WAIT_MS', 3_000);

  // Circuit breaker: after `failureThreshold` consecutive Redis errors, skip Redis for `openMs`.
  private failures = 0;
  private openUntil = 0;
  private readonly failureThreshold = 3;
  private readonly openMs = 10_000;

  constructor(
    @Inject(CACHE_REDIS) private readonly redis: Redis | null,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  get enabled(): boolean {
    return process.env.CACHE_ENABLED === 'true' && this.redis !== null;
  }

  private available(): boolean {
    return this.enabled && Date.now() >= this.openUntil;
  }

  private ok(): void {
    this.failures = 0;
  }

  private fail(error: unknown): void {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.openUntil = Date.now() + this.openMs;
      this.failures = 0;
      this.logger.warn(`Redis errors — bypassing the cache for ${this.openMs / 1000}s: ${(error as Error).message}`);
    }
  }

  private count(name: string, result: 'hit' | 'miss' | 'bypass' | 'error'): void {
    this.metrics?.cacheRequests.inc({ name, result });
  }

  /**
   * Returns the cached value for (tenant, name) or computes it with `loader`.
   * `ttlSeconds` bounds staleness for writes that do not go through the API.
   */
  async wrap<T>(organisationId: string, name: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    if (!this.available() || !this.redis) {
      this.count(name, 'bypass');
      return loader();
    }
    const redis = this.redis;

    let key: string;
    try {
      const version = (await redis.get(`tenant:${organisationId}:ver`)) ?? '0';
      // A non-admin user sees only their own records, so their cached aggregates are theirs alone.
      const owner = getRecordOwnerScope();
      key = `tenant:${organisationId}:v${version}:${owner ? `u:${owner}:` : ''}${name}`;
      const cached = await redis.get(key);
      this.ok();
      if (cached !== null) {
        this.count(name, 'hit');
        return JSON.parse(cached) as T;
      }
    } catch (error) {
      this.fail(error);
      this.count(name, 'error');
      return loader();
    }

    this.count(name, 'miss');
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const computation = this.computeAndStore(redis, key, ttlSeconds, loader).finally(() => this.inflight.delete(key));
    this.inflight.set(key, computation);
    return computation;
  }

  private async computeAndStore<T>(redis: Redis, key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const lockKey = `lock:${key}`;
    const token = randomUUID();
    let haveLock = false;

    try {
      haveLock = (await redis.set(lockKey, token, 'PX', this.lockTtlMs, 'NX')) === 'OK';
      if (!haveLock) {
        // Another instance is computing it: wait briefly for its result instead of duplicating the work.
        const deadline = Date.now() + this.lockWaitMs;
        while (Date.now() < deadline) {
          await sleep(75);
          const cached = await redis.get(key);
          if (cached !== null) return JSON.parse(cached) as T;
        }
        // Waited long enough — fall through and compute it ourselves.
      }
    } catch (error) {
      this.fail(error);
    }

    try {
      const value = await loader();
      try {
        const serialized = JSON.stringify(value);
        if (serialized !== undefined && Buffer.byteLength(serialized) <= this.maxValueBytes) {
          await redis.set(key, serialized, 'EX', ttlSeconds);
        }
        this.ok();
      } catch (error) {
        this.fail(error);
      }
      return value;
    } finally {
      if (haveLock) {
        await redis.eval(RELEASE_LOCK, 1, lockKey, token).catch(() => undefined);
      }
    }
  }

  /**
   * Cached total for a list page ("Showing 1-20 of N"). `COUNT(*)` over a large tenant is O(rows) whatever the
   * indexes (250-800 ms at ~1M rows) and is repeated for every page and every visit, while the answer only changes
   * when the tenant writes. Same guarantees as `wrap`: keyed per tenant + entity + a hash of the exact filter,
   * invalidated by any write of the tenant, TTL-bounded, fail-open.
   *
   * Only for entities that are written EXCLUSIVELY through the API (candidates, companies, contacts, jobs,
   * applications, placements). Entities that background jobs also write (notifications, audit log) must not use it.
   */
  cachedCount(organisationId: string, entity: string, where: unknown, loader: () => Promise<number>): Promise<number> {
    const digest = createHash('sha1')
      .update(JSON.stringify(where ?? null))
      .digest('hex')
      .slice(0, 20);
    return this.wrap(organisationId, `count:${entity}:${digest}`, envInt('CACHE_COUNT_TTL_SECONDS', 60), loader);
  }

  /** Orphans every cached value of one tenant. Awaited by the caller so a client always reads its own writes. */
  async invalidateTenant(organisationId: string): Promise<void> {
    if (!this.available() || !this.redis) return;
    try {
      await this.redis.incr(`tenant:${organisationId}:ver`);
      this.ok();
    } catch (error) {
      this.fail(error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) await this.redis.quit().catch(() => undefined);
  }
}
