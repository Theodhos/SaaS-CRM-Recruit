import { ThrottlerStorageService } from '@nestjs/throttler';
import type Redis from 'ioredis';

import { connectTestRedis, deadRedis, describeRedis, sleep, unique } from '../testing/redis-test-utils';

import { RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * The Redis storage must behave like Nest's in-memory storage (a hit counts for `ttl` ms after it happened; going
 * over `limit` blocks the key for `blockDuration`; blocked requests are not counted; when a block ends the key
 * starts fresh) — otherwise switching THROTTLER_STORAGE would change what a client experiences. The parity test
 * below drives both implementations through the same sequence and compares every step.
 */
describeRedis('RedisThrottlerStorage (real Redis)', () => {
  let redis: Redis;
  beforeAll(() => {
    redis = connectTestRedis();
  });
  afterAll(async () => {
    await redis.quit();
  });

  it('matches the in-memory storage step for step, including blocking', async () => {
    const memory = new ThrottlerStorageService();
    const shared = new RedisThrottlerStorage(redis);
    const key = unique('parity');
    const limit = 5;

    for (let hit = 1; hit <= 8; hit += 1) {
      const a = await memory.increment(key, 5_000, limit, 5_000, 'default');
      const b = await shared.increment(key, 5_000, limit, 5_000, 'default');
      expect({ hit, hits: b.totalHits, blocked: b.isBlocked }).toEqual({ hit, hits: a.totalHits, blocked: a.isBlocked });
    }
    memory.onApplicationShutdown();
  });

  it('counts within the window and blocks once the limit is exceeded', async () => {
    const storage = new RedisThrottlerStorage(redis);
    const key = unique('limit');

    const seen = [];
    for (let i = 0; i < 4; i += 1) seen.push(await storage.increment(key, 10_000, 3, 10_000, 'default'));

    expect(seen.map((r) => r.totalHits)).toEqual([1, 2, 3, 4]);
    expect(seen.map((r) => r.isBlocked)).toEqual([false, false, false, true]);
    expect(seen[3]?.timeToBlockExpire).toBeGreaterThan(0);

    // Blocked requests are not counted, so the counter stays where it was.
    const stillBlocked = await storage.increment(key, 10_000, 3, 10_000, 'default');
    expect(stillBlocked.isBlocked).toBe(true);
    expect(stillBlocked.totalHits).toBe(4);
  });

  it('forgets hits once they are older than the window (sliding window)', async () => {
    const storage = new RedisThrottlerStorage(redis);
    const key = unique('slide');

    await storage.increment(key, 400, 100, 400, 'default');
    await storage.increment(key, 400, 100, 400, 'default');
    await sleep(500);
    const after = await storage.increment(key, 400, 100, 400, 'default');

    expect(after.totalHits).toBe(1);
  });

  it('starts fresh after a block expires', async () => {
    const storage = new RedisThrottlerStorage(redis);
    const key = unique('unblock');

    await storage.increment(key, 2_000, 1, 300, 'default');
    const blocked = await storage.increment(key, 2_000, 1, 300, 'default');
    expect(blocked.isBlocked).toBe(true);

    await sleep(400);
    const fresh = await storage.increment(key, 2_000, 1, 300, 'default');
    expect(fresh).toMatchObject({ totalHits: 1, isBlocked: false });
  });

  it('keeps separate counters per key and per throttler name', async () => {
    const storage = new RedisThrottlerStorage(redis);
    const key = unique('iso');

    await storage.increment(key, 10_000, 10, 10_000, 'default');
    await storage.increment(key, 10_000, 10, 10_000, 'default');
    const otherName = await storage.increment(key, 10_000, 10, 10_000, 'strict');
    const otherKey = await storage.increment(`${key}-2`, 10_000, 10, 10_000, 'default');

    expect(otherName.totalHits).toBe(1);
    expect(otherKey.totalHits).toBe(1);
  });

  it('is atomic under concurrency: N parallel hits are all counted', async () => {
    const storage = new RedisThrottlerStorage(redis);
    const key = unique('race');

    const results = await Promise.all(Array.from({ length: 25 }, () => storage.increment(key, 10_000, 1_000, 10_000, 'default')));

    expect(new Set(results.map((r) => r.totalHits)).size).toBe(25); // no two callers saw the same count
    expect(Math.max(...results.map((r) => r.totalHits))).toBe(25);
  });
});

describe('RedisThrottlerStorage fail-open', () => {
  it('falls back to counting in memory when Redis is unreachable — requests are not failed', async () => {
    const storage = new RedisThrottlerStorage(deadRedis());
    const key = unique('down');

    const first = await storage.increment(key, 5_000, 2, 5_000, 'default');
    const second = await storage.increment(key, 5_000, 2, 5_000, 'default');
    const third = await storage.increment(key, 5_000, 2, 5_000, 'default');

    expect([first.totalHits, second.totalHits, third.totalHits]).toEqual([1, 2, 3]);
    expect(third.isBlocked).toBe(true);
    storage.onApplicationShutdown();
  });

  it('works with no Redis client at all', async () => {
    const storage = new RedisThrottlerStorage(null);
    const record = await storage.increment(unique('null'), 5_000, 5, 5_000, 'default');
    expect(record.totalHits).toBe(1);
    storage.onApplicationShutdown();
  });
});
