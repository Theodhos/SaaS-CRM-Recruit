import type Redis from 'ioredis';

import { connectTestRedis, deadRedis, describeRedis, restoreEnv, sleep, unique } from '../testing/redis-test-utils';

import { SchedulerLockService } from './scheduler-lock.service';

describeRedis('SchedulerLockService (real Redis)', () => {
  let redis: Redis;
  const previous = { lock: process.env.SCHEDULER_LOCK, enabled: process.env.SCHEDULER_ENABLED };

  beforeAll(() => {
    redis = connectTestRedis();
    process.env.SCHEDULER_LOCK = 'redis';
    delete process.env.SCHEDULER_ENABLED;
  });
  afterAll(async () => {
    restoreEnv('SCHEDULER_LOCK', previous.lock);
    restoreEnv('SCHEDULER_ENABLED', previous.enabled);
    await redis.quit();
  });

  it('runs a sweep on exactly ONE of several replicas ticking at the same instant', async () => {
    const name = unique('sweep');
    const replicas = Array.from({ length: 5 }, () => new SchedulerLockService(redis));
    let runs = 0;
    const job = async () => {
      runs += 1;
      await sleep(150);
    };

    await Promise.all(replicas.map((r) => r.runExclusive(name, 5_000, job)));

    expect(runs).toBe(1);
  });

  it('releases the lock when the sweep finishes, so the next tick can run', async () => {
    const name = unique('sweep');
    const lock = new SchedulerLockService(redis);
    let runs = 0;

    await lock.runExclusive(name, 5_000, async () => void (runs += 1));
    await lock.runExclusive(name, 5_000, async () => void (runs += 1));

    expect(runs).toBe(2);
  });

  it('releases the lock even if the sweep throws', async () => {
    const name = unique('sweep');
    const lock = new SchedulerLockService(redis);

    await expect(lock.runExclusive(name, 5_000, async () => Promise.reject(new Error('sweep failed')))).rejects.toThrow('sweep failed');

    let ran = false;
    await lock.runExclusive(name, 5_000, async () => void (ran = true));
    expect(ran).toBe(true);
  });

  it('a crashed holder cannot block the schedule forever: the lock expires by TTL', async () => {
    const name = unique('sweep');
    await redis.set(`lock:scheduler:${name}`, 'dead-replica', 'PX', 200); // a holder that never released
    const lock = new SchedulerLockService(redis);
    let runs = 0;

    await lock.runExclusive(name, 5_000, async () => void (runs += 1)); // still held -> skipped
    await sleep(300);
    await lock.runExclusive(name, 5_000, async () => void (runs += 1)); // expired -> runs

    expect(runs).toBe(1);
  });

  it('does not release a lock it no longer owns', async () => {
    const name = unique('sweep');
    const lock = new SchedulerLockService(redis);

    await lock.runExclusive(name, 100, async () => {
      await sleep(250); // outlives its own TTL…
      await redis.set(`lock:scheduler:${name}`, 'someone-else', 'PX', 5_000); // …and another replica took over
    });

    expect(await redis.get(`lock:scheduler:${name}`)).toBe('someone-else');
  });
});

describe('SchedulerLockService defaults and fail-open', () => {
  const previous = { lock: process.env.SCHEDULER_LOCK, enabled: process.env.SCHEDULER_ENABLED };
  afterEach(() => {
    restoreEnv('SCHEDULER_LOCK', previous.lock);
    restoreEnv('SCHEDULER_ENABLED', previous.enabled);
  });

  it('by default (no SCHEDULER_LOCK) every instance runs every sweep — behaviour is unchanged', async () => {
    delete process.env.SCHEDULER_LOCK;
    delete process.env.SCHEDULER_ENABLED;
    const lock = new SchedulerLockService(null);
    let runs = 0;

    await Promise.all([lock.runExclusive('x', 1_000, async () => void (runs += 1)), lock.runExclusive('x', 1_000, async () => void (runs += 1))]);

    expect(runs).toBe(2);
  });

  it('runs the sweep anyway when Redis is unreachable (a duplicate reminder beats a missing one)', async () => {
    process.env.SCHEDULER_LOCK = 'redis';
    const lock = new SchedulerLockService(deadRedis());
    let ran = false;

    await lock.runExclusive('x', 1_000, async () => void (ran = true));

    expect(ran).toBe(true);
  });

  it('SCHEDULER_ENABLED=false switches the sweeps off on this instance', async () => {
    process.env.SCHEDULER_ENABLED = 'false';
    const lock = new SchedulerLockService(null);
    let ran = false;

    await lock.runExclusive('x', 1_000, async () => void (ran = true));

    expect(ran).toBe(false);
  });
});
