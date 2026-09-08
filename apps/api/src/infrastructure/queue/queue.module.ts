import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { QUEUE_NAMES } from './queue.constants';

/**
 * Registers BullMQ queues so services can inject a producer (`@InjectQueue`)
 * to enqueue background work without ever executing it inline on the
 * request thread. Actual job processing happens in apps/worker, which
 * registers the same queue names as consumers.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL', 'redis://localhost:6379') },
      }),
    }),
    BullModule.registerQueue(...Object.values(QUEUE_NAMES).map((name) => ({ name }))),
  ],
  exports: [BullModule],
})
export class QueueModule {}
