import { QUEUE_NAMES } from '@crm/config';
import { createLogger } from '@crm/logger';
import { Worker, type Job } from 'bullmq';

import { getQueueConnection } from '../../config/redis-connection';

const logger = createLogger({ serviceName: 'worker:notifications' });

/**
 * notifications processor — skeleton only (Phase 1: architecture). Job payload
 * types and real processing logic land in Phase 2 alongside the relevant
 * API module.
 */
export const notificationsWorker = new Worker(
  QUEUE_NAMES.NOTIFICATIONS,
  async (job: Job) => {
    logger.info({ jobId: job.id, name: job.name }, 'Processing job (not yet implemented)');
  },
  { connection: getQueueConnection(), concurrency: 5 },
);

notificationsWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error: error.message }, 'Job failed');
});
