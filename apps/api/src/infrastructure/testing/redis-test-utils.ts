import Redis from 'ioredis';

/**
 * Integration tests for the Redis-backed features run against a REAL Redis (mocks would not prove that the Lua
 * scripts, NX locks and key layout behave). Point TEST_REDIS_URL at a disposable instance, e.g.
 *   TEST_REDIS_URL=redis://127.0.0.1:6379 pnpm --filter @crm/api test
 * Without it those suites are skipped (CI provides a Redis service container).
 */
export const TEST_REDIS_URL = process.env.TEST_REDIS_URL;
export const describeRedis: jest.Describe = TEST_REDIS_URL ? describe : describe.skip;

export function connectTestRedis(): Redis {
  return new Redis(TEST_REDIS_URL ?? 'redis://127.0.0.1:6379', { maxRetriesPerRequest: 1, commandTimeout: 500 });
}

/** A client pointed at a port nothing listens on: every command fails fast, like an unreachable Redis. */
export function deadRedis(): Redis {
  const client = new Redis({
    host: '127.0.0.1',
    port: 1, // closed
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    commandTimeout: 100,
    retryStrategy: () => null,
  });
  client.on('error', () => undefined);
  return client;
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Unique per test so suites never see each other's keys. */
export const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** `process.env.X = undefined` stores the STRING "undefined"; restoring an unset variable must delete it. */
export function restoreEnv(name: string, previous: string | undefined): void {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}
