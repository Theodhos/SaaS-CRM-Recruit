import { loadEnv } from '@crm/config';
import type { ConnectionOptions } from 'bullmq';

/** Single BullMQ connection descriptor, shared by every processor. */
export function getQueueConnection(): ConnectionOptions {
  const env = loadEnv();
  return { url: env.REDIS_URL };
}
