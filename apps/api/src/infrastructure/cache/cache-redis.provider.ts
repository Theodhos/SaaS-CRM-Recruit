import { Logger } from '@nestjs/common';
import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { envInt } from './env';

export const CACHE_REDIS = Symbol('CACHE_REDIS');

const logger = new Logger('CacheRedis');

/** Does any opt-in feature need Redis in this process? If none does, we never open a connection at all. */
export function redisFeaturesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.CACHE_ENABLED === 'true' ||
    env.THROTTLER_STORAGE === 'redis' ||
    env.SCHEDULER_LOCK === 'redis' ||
    env.HEALTH_REQUIRE_REDIS === 'true'
  );
}

/**
 * A Redis client dedicated to cache / rate-limit counters / scheduler locks — deliberately separate from the
 * BullMQ connection, because the two want opposite failure behaviour:
 *
 *  - BullMQ waits and retries (jobs must not be lost);
 *  - the cache must FAIL FAST so a slow or dead Redis never adds latency to a request. Every call has a short
 *    `commandTimeout`, there is no offline queue, and callers treat any error as "no cache" (fail-open).
 *
 * The connection is reconnected with a capped backoff (unlike the queue module's `retryStrategy: () => null`,
 * a cache client must recover on its own after a Redis restart).
 *
 * Provides `null` when no Redis-backed feature is enabled, so default behaviour (and dev without Redis) is
 * exactly what it was before.
 */
export const cacheRedisProvider: Provider = {
  provide: CACHE_REDIS,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Redis | null => {
    if (!redisFeaturesEnabled()) return null;

    const url = config.get<string>('REDIS_CACHE_URL') || config.get<string>('REDIS_URL', 'redis://localhost:6379');
    const client = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: envInt('REDIS_CONNECT_TIMEOUT_MS', 1000),
      commandTimeout: envInt('REDIS_COMMAND_TIMEOUT_MS', 200),
      retryStrategy: (attempt) => Math.min(attempt * 500, 10_000),
    });

    // Log at most once per 30 s: a Redis outage must not turn into a log flood.
    let lastLogged = 0;
    client.on('error', (error) => {
      const now = Date.now();
      if (now - lastLogged > 30_000) {
        lastLogged = now;
        logger.warn(`Redis unavailable, continuing without it (fail-open): ${error.message}`);
      }
    });
    client.on('ready', () => logger.log('Redis connection ready'));

    // Connect in the background; never block boot on it.
    void client.connect().catch(() => undefined);
    return client;
  },
};
