// HealthService only needs `client.$queryRaw`; avoid instantiating the real Prisma client.
jest.mock('../infrastructure/database/database.service', () => ({ DatabaseService: class DatabaseService {} }));

import type { DatabaseService } from '../infrastructure/database/database.service';
import { restoreEnv } from '../infrastructure/testing/redis-test-utils';

import { HealthService } from './health.service';

function makeDb(query: () => Promise<unknown>) {
  return { client: { $queryRaw: jest.fn(query) } } as unknown as DatabaseService & { client: { $queryRaw: jest.Mock } };
}

describe('HealthService.ready', () => {
  const previous = { redis: process.env.HEALTH_REQUIRE_REDIS, drain: process.env.SHUTDOWN_DRAIN_MS };
  afterEach(() => {
    restoreEnv('HEALTH_REQUIRE_REDIS', previous.redis);
    restoreEnv('SHUTDOWN_DRAIN_MS', previous.drain);
  });

  it('is ready when the database answers (Redis is optional and reported as skipped)', async () => {
    delete process.env.HEALTH_REQUIRE_REDIS;
    const health = new HealthService(makeDb(async () => [{ '?column?': 1 }]), null);

    await expect(health.ready()).resolves.toEqual({ ok: true, checks: { database: 'up', redis: 'skipped' } });
  });

  it('is NOT ready when the database is unreachable', async () => {
    const health = new HealthService(makeDb(async () => Promise.reject(new Error('connection refused'))), null);

    const result = await health.ready();

    expect(result.ok).toBe(false);
    expect(result.checks.database).toBe('down');
  });

  it('is NOT ready when the database hangs (bounded by a timeout, never blocks the probe)', async () => {
    jest.useFakeTimers();
    try {
      const health = new HealthService(makeDb(() => new Promise(() => undefined)), null);
      const pending = health.ready();
      await jest.advanceTimersByTimeAsync(2_100);

      await expect(pending).resolves.toMatchObject({ ok: false, checks: { database: 'down' } });
    } finally {
      jest.useRealTimers();
    }
  });

  it('requires Redis only when HEALTH_REQUIRE_REDIS=true', async () => {
    process.env.HEALTH_REQUIRE_REDIS = 'true';
    const db = makeDb(async () => 1);

    const withoutClient = await new HealthService(db, null).ready();
    expect(withoutClient).toMatchObject({ ok: false, checks: { redis: 'down' } });

    const withPing = await new HealthService(db, { ping: async () => 'PONG' } as never).ready();
    expect(withPing).toMatchObject({ ok: true, checks: { redis: 'up' } });
  });

  it('memoises for one second so probes from many load balancers do not become a query storm', async () => {
    const db = makeDb(async () => 1);
    const health = new HealthService(db, null);

    await Promise.all([health.ready(), health.ready(), health.ready()]);
    await health.ready();

    expect(db.client.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('flips to not-ready IMMEDIATELY on shutdown, then waits the drain window before letting the server close', async () => {
    process.env.SHUTDOWN_DRAIN_MS = '80';
    const health = new HealthService(makeDb(async () => 1), null);
    expect((await health.ready()).ok).toBe(true);

    const started = Date.now();
    const shutdown = health.beforeApplicationShutdown('SIGTERM');
    expect((await health.ready()).checks).toEqual({ shutdown: 'draining' }); // not-ready during the drain
    await shutdown;

    expect(Date.now() - started).toBeGreaterThanOrEqual(70);
  });

  it('does not wait when no drain window is configured (default behaviour unchanged)', async () => {
    delete process.env.SHUTDOWN_DRAIN_MS;
    const health = new HealthService(makeDb(async () => 1), null);

    const started = Date.now();
    await health.beforeApplicationShutdown('SIGTERM');

    expect(Date.now() - started).toBeLessThan(50);
  });
});
