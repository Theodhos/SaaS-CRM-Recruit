import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { redisRetryStrategy } from '../redis/retry-strategy';

import { QUEUE_NAMES } from './queue.constants';

/**
 * Registers BullMQ queues so services can inject a producer (`@InjectQueue`)
 * to enqueue background work without ever executing it inline on the
 * request thread. Actual job processing happens in apps/worker, which
 * registers the same queue names as consumers.
 *
 * `lazyConnect` + no retry strategy: queue producers aren't used by any
 * Phase 2 request path, so a missing Redis must not block API boot (see
 * RedisModule for the same reasoning). Enqueuing a job against an
 * unreachable Redis will fail loudly at the call site once a Phase 4+
 * feature actually calls `queue.add(...)`, which is the right place for
 * that error to surface.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.get<string>('REDIS_URL', 'redis://localhost:6379'));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
            lazyConnect: true,
            maxRetriesPerRequest: null,
            retryStrategy: redisRetryStrategy(),
          },
        };
      },
    }),
    BullModule.registerQueue(...Object.values(QUEUE_NAMES).map((name) => ({ name }))),
  ],
  exports: [BullModule],
})
export class QueueModule {}
