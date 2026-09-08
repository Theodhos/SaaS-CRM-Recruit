/**
 * Canonical BullMQ queue names — the single source of truth shared by
 * apps/api (producers) and apps/worker (consumers) so the two apps can
 * never drift on a queue name string.
 */
export const QUEUE_NAMES = {
  EMAIL: 'email',
  DOCUMENTS: 'documents',
  CV_PARSING: 'cv-parsing',
  NOTIFICATIONS: 'notifications',
  ANALYTICS: 'analytics',
  REPORTS: 'reports',
  IMPORTS: 'imports',
  EXPORTS: 'exports',
  SCHEDULED_TASKS: 'scheduled-tasks',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
