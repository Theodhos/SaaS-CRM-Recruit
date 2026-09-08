import { createLogger } from '@crm/logger';

import { analyticsWorker } from './processors/analytics/analytics.processor';
import { cvParsingWorker } from './processors/cv-parsing/cv-parsing.processor';
import { documentsWorker } from './processors/documents/documents.processor';
import { emailWorker } from './processors/email/email.processor';
import { exportsWorker } from './processors/exports/exports.processor';
import { importsWorker } from './processors/imports/imports.processor';
import { notificationsWorker } from './processors/notifications/notifications.processor';
import { reportsWorker } from './processors/reports/reports.processor';
import { scheduledTasksWorker } from './processors/scheduled-tasks/scheduled-tasks.processor';

const logger = createLogger({ serviceName: 'worker' });

const workers = [
  emailWorker,
  documentsWorker,
  cvParsingWorker,
  notificationsWorker,
  analyticsWorker,
  reportsWorker,
  importsWorker,
  exportsWorker,
  scheduledTasksWorker,
];

logger.info(`Worker process started with ${workers.length} queue processors`);

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, closing workers gracefully...`);
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
