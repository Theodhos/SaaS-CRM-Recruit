// Re-exported for a shorter local import path within apps/api. The
// canonical definition lives in @crm/config so apps/worker (the consumer
// side) shares the exact same queue names — see packages/config/src/queues.ts.
export { QUEUE_NAMES } from '@crm/config';
export type { QueueName } from '@crm/config';
