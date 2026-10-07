import type Redis from 'ioredis';

import { connectTestRedis, deadRedis, describeRedis, restoreEnv, sleep, unique } from '../testing/redis-test-utils';

import { CacheService } from './cache.service';

describeRedis('CacheService (real Redis)', () => {
  let redis: Redis;
  const previous = process.env.CACHE_ENABLED;

  beforeAll(() => {
    redis = connectTestRedis();
    process.env.CACHE_ENABLED = 'true';
  });
  afterAll(async () => {
    restoreEnv('CACHE_ENABLED', previous);
    await redis.quit();
  });

  const make = () => new CacheService(redis);

  it('computes once, then serves the cached value', async () => {
    const cache = make();
    const org = unique('org');
    const loader = jest.fn(async () => ({ total: 42 }));

    const first = await cache.wrap(org, 'dash', 30, loader);
    const second = await cache.wrap(org, 'dash', 30, loader);

    expect(first).toEqual({ total: 42 });
    expect(second).toEqual({ total: 42 });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('never leaks one tenant’s value to another (tenant isolation)', async () => {
    const cache = make();
    const orgA = unique('orgA');
    const orgB = unique('orgB');

    const a = await cache.wrap(orgA, 'dash', 30, async () => ({ owner: 'A' }));
    const b = await cache.wrap(orgB, 'dash', 30, async () => ({ owner: 'B' }));
    const aAgain = await cache.wrap(orgA, 'dash', 30, async () => ({ owner: 'WRONG' }));

    expect(a).toEqual({ owner: 'A' });
    expect(b).toEqual({ owner: 'B' });
    expect(aAgain).toEqual({ owner: 'A' });
    // and the keys physically carry the tenant id
    const keys = await redis.keys(`tenant:${orgA}:*`);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k) => k.startsWith(`tenant:${orgA}:`))).toBe(true);
  });

  it('invalidates a tenant instantly (read-your-writes) without touching other tenants', async () => {
    const cache = make();
    const org = unique('org');
    const other = unique('other');
    let n = 0;
    const loader = async () => ({ n: ++n });

    expect(await cache.wrap(org, 'dash', 30, loader)).toEqual({ n: 1 });
    await cache.wrap(other, 'dash', 30, async () => ({ untouched: true }));
    expect(await cache.wrap(org, 'dash', 30, loader)).toEqual({ n: 1 }); // still cached

    await cache.invalidateTenant(org);

    expect(await cache.wrap(org, 'dash', 30, loader)).toEqual({ n: 2 }); // recomputed
    const otherLoader = jest.fn(async () => ({ untouched: false }));
    expect(await cache.wrap(other, 'dash', 30, otherLoader)).toEqual({ untouched: true }); // other tenant still cached
    expect(otherLoader).not.toHaveBeenCalled();
  });

  it('a value computed from pre-write data is never served after the write (version captured before the loader)', async () => {
    const cache = make();
    const org = unique('org');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));

    // A slow read starts (sees version N)…
    const slow = cache.wrap(org, 'dash', 30, async () => {
      await gate;
      return { data: 'stale-snapshot' };
    });
    await sleep(50);
    // …a write lands and invalidates while it is still computing…
    await cache.invalidateTenant(org);
    release();
    await slow;

    // …so the next read must recompute instead of returning the stale snapshot.
    const fresh = await cache.wrap(org, 'dash', 30, async () => ({ data: 'fresh' }));
    expect(fresh).toEqual({ data: 'fresh' });
  });

  it('collapses concurrent misses into one computation (stampede protection)', async () => {
    const cache = make();
    const org = unique('org');
    const loader = jest.fn(async () => {
      await sleep(150);
      return { expensive: true };
    });

    const results = await Promise.all(Array.from({ length: 20 }, () => cache.wrap(org, 'dash', 30, loader)));

    expect(loader).toHaveBeenCalledTimes(1);
    expect(results.every((r) => (r as { expensive: boolean }).expensive)).toBe(true);
  });

  it('collapses concurrent misses ACROSS instances too (cross-process lock)', async () => {
    const org = unique('org');
    const loader = jest.fn(async () => {
      await sleep(200);
      return { expensive: true };
    });
    const instances = [make(), make(), make()]; // three "replicas", separate in-process state, one Redis

    const results = await Promise.all(instances.map((c) => c.wrap(org, 'dash', 30, loader)));

    expect(loader).toHaveBeenCalledTimes(1);
    expect(results.every((r) => (r as { expensive: boolean }).expensive)).toBe(true);
  });

  it('expires by TTL', async () => {
    const cache = make();
    const org = unique('org');
    let n = 0;
    const loader = async () => ({ n: ++n });

    await cache.wrap(org, 'dash', 1, loader);
    await sleep(1_200);

    expect(await cache.wrap(org, 'dash', 1, loader)).toEqual({ n: 2 });
  });

  it('does not cache a failed computation', async () => {
    const cache = make();
    const org = unique('org');
    let calls = 0;

    await expect(
      cache.wrap(org, 'dash', 30, async () => {
        calls += 1;
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await cache.wrap(org, 'dash', 30, async () => ({ ok: ++calls }))).toEqual({ ok: 2 });
  });

  it('skips oversized values but still returns them', async () => {
    const previousMax = process.env.CACHE_MAX_VALUE_BYTES;
    process.env.CACHE_MAX_VALUE_BYTES = '50';
    try {
      const cache = make();
      const org = unique('org');
      const loader = jest.fn(async () => ({ blob: 'x'.repeat(500) }));

      await cache.wrap(org, 'big', 30, loader);
      await cache.wrap(org, 'big', 30, loader);

      expect(loader).toHaveBeenCalledTimes(2); // never stored
    } finally {
      restoreEnv('CACHE_MAX_VALUE_BYTES', previousMax);
    }
  });

  describe('cachedCount (list totals)', () => {
    it('is keyed by the exact filter: same filter -> one COUNT, different filter -> its own COUNT', async () => {
      const cache = make();
      const org = unique('org');
      const countActive = jest.fn(async () => 921_500);
      const countPassive = jest.fn(async () => 1_234);

      const a1 = await cache.cachedCount(org, 'candidates', { deletedAt: null, status: 'ACTIVE' }, countActive);
      const a2 = await cache.cachedCount(org, 'candidates', { deletedAt: null, status: 'ACTIVE' }, countActive);
      const p = await cache.cachedCount(org, 'candidates', { deletedAt: null, status: 'PASSIVE' }, countPassive);

      expect([a1, a2, p]).toEqual([921_500, 921_500, 1_234]);
      expect(countActive).toHaveBeenCalledTimes(1);
      expect(countPassive).toHaveBeenCalledTimes(1);
    });

    it('never shares a total between tenants, and a write by one tenant leaves the other cached', async () => {
      const cache = make();
      const orgA = unique('orgA');
      const orgB = unique('orgB');
      const where = { deletedAt: null };

      expect(await cache.cachedCount(orgA, 'jobs', where, async () => 10)).toBe(10);
      expect(await cache.cachedCount(orgB, 'jobs', where, async () => 99)).toBe(99);

      await cache.invalidateTenant(orgA);

      expect(await cache.cachedCount(orgA, 'jobs', where, async () => 11)).toBe(11); // recomputed after A's write
      expect(await cache.cachedCount(orgB, 'jobs', where, async () => -1)).toBe(99); // B untouched
    });

    it('a filter that differs only in a nested value gets its own key (no collisions)', async () => {
      const cache = make();
      const org = unique('org');
      const one = await cache.cachedCount(org, 'applications', { job: { companyId: 'c1' } }, async () => 1);
      const two = await cache.cachedCount(org, 'applications', { job: { companyId: 'c2' } }, async () => 2);
      expect([one, two]).toEqual([1, 2]);
    });
  });

  it('returns identical JSON on a cache hit (Dates serialise the same)', async () => {
    const cache = make();
    const org = unique('org');
    const value = { at: new Date('2026-01-02T03:04:05.000Z'), n: 1, nested: { list: [1, 2, 3], none: null } };

    const miss = await cache.wrap(org, 'json', 30, async () => value);
    const hit = await cache.wrap(org, 'json', 30, async () => ({ never: 'used' }));

    expect(JSON.stringify(hit)).toBe(JSON.stringify(miss));
  });
});

describe('CacheService fail-open / disabled', () => {
  const previous = process.env.CACHE_ENABLED;
  afterEach(() => {
    restoreEnv('CACHE_ENABLED', previous);
  });

  it('just runs the loader when the cache is disabled (the default)', async () => {
    process.env.CACHE_ENABLED = 'false';
    const cache = new CacheService(null);
    const loader = jest.fn(async () => 'fresh');

    expect(await cache.wrap('org', 'x', 30, loader)).toBe('fresh');
    expect(await cache.wrap('org', 'x', 30, loader)).toBe('fresh');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('just runs the loader when Redis is unreachable — a Redis outage never fails a request', async () => {
    process.env.CACHE_ENABLED = 'true';
    const cache = new CacheService(deadRedis());
    const loader = jest.fn(async () => ({ ok: true }));

    expect(await cache.wrap('org', 'x', 30, loader)).toEqual({ ok: true });
    expect(loader).toHaveBeenCalledTimes(1);
    await expect(cache.invalidateTenant('org')).resolves.toBeUndefined(); // swallowed
  });

  it('opens a circuit breaker after repeated Redis failures and stops calling Redis', async () => {
    process.env.CACHE_ENABLED = 'true';
    const redis = deadRedis();
    const get = jest.spyOn(redis, 'get');
    const cache = new CacheService(redis);
    const loader = async () => 1;

    for (let i = 0; i < 3; i += 1) await cache.wrap('org', 'x', 30, loader);
    const callsAtOpen = get.mock.calls.length;
    for (let i = 0; i < 5; i += 1) await cache.wrap('org', 'x', 30, loader);

    expect(get.mock.calls.length).toBe(callsAtOpen); // bypassed while the breaker is open
  });
});
