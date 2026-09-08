import { QUEUE_NAMES } from '@crm/config';
import { createLogger } from '@crm/logger';
import { Worker, type Job } from 'bullmq';

import { getQueueConnection } from '../../config/redis-connection';

const logger = createLogger({ serviceName: 'worker:reports' });

/**
 * reports processor — skeleton only (Phase 1: architecture). Job payload
 * types and real processing logic land in Phase 2 alongside the relevant
 * API module.
 */
export const reportsWorker = new Worker(
  QUEUE_NAMES.REPORTS,
  async (job: Job) => {
    logger.info({ jobId: job.id, name: job.name }, 'Processing job (not yet implemented)');
  },
  { connection: getQueueConnection(), concurrency: 5 },
);

reportsWorker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error: error.message }, 'Job failed');
});
