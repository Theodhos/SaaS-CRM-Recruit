import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import { REDIS_CLIENT } from './redis.constants';
import { redisRetryStrategy } from './retry-strategy';

const logger = new Logger('RedisModule');

/**
 * Global module exposing a single ioredis connection, reused for caching
 * and (indirectly, via BullMQ's own connection) queueing. See
 * infrastructure/queue for job-queue-specific wiring.
 *
 * `lazyConnect: true` + a bound 'error' listener are deliberate: Redis is
 * not on the critical path for auth/CRUD requests, and an unhandled 'error'
 * event on an eagerly-connecting ioredis client would otherwise crash the
 * whole API process the moment Redis is unreachable (e.g. a dev machine
 * without Docker running). Anything that genuinely needs Redis (BullMQ
 * producers in Phase 4+) will surface a clear connection error at the point
 * of use instead.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const client = new Redis(config.get<string>('REDIS_URL', 'redis://localhost:6379'), {
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          // Dev: don't keep retrying a Redis that isn't there. Production: reconnect with backoff (see retry-strategy.ts).
          retryStrategy: redisRetryStrategy(),
        });
        client.on('error', (error) => logger.warn(`Redis connection unavailable: ${error.message}`));
        return client;
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
