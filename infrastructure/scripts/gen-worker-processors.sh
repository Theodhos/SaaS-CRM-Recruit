#!/usr/bin/env bash
set -euo pipefail

WORKER_SRC="apps/worker/src/processors"

# folder:QUEUE_NAMES_KEY:camelCaseName
declare -a PROCS=(
  "email:EMAIL:email"
  "documents:DOCUMENTS:documents"
  "cv-parsing:CV_PARSING:cvParsing"
  "notifications:NOTIFICATIONS:notifications"
  "analytics:ANALYTICS:analytics"
  "reports:REPORTS:reports"
  "imports:IMPORTS:imports"
  "exports:EXPORTS:exports"
  "scheduled-tasks:SCHEDULED_TASKS:scheduledTasks"
)

for entry in "${PROCS[@]}"; do
  folder="${entry%%:*}"
  rest="${entry#*:}"
  queueKey="${rest%%:*}"
  camel="${rest#*:}"

  dir="$WORKER_SRC/$folder"
  mkdir -p "$dir"

  cat > "$dir/$folder.processor.ts" <<EOF
import { Worker, type Job } from 'bullmq';

import { QUEUE_NAMES } from '@crm/config';
import { createLogger } from '@crm/logger';

import { getQueueConnection } from '../../config/redis-connection';

const logger = createLogger({ serviceName: 'worker:$folder' });

/**
 * ${folder} processor — skeleton only (Phase 1: architecture). Job payload
 * types and real processing logic land in Phase 2 alongside the relevant
 * API module.
 */
export const ${camel}Worker = new Worker(
  QUEUE_NAMES.$queueKey,
  async (job: Job) => {
    logger.info({ jobId: job.id, name: job.name }, 'Processing job (not yet implemented)');
  },
  { connection: getQueueConnection(), concurrency: 5 },
);

${camel}Worker.on('failed', (job, error) => {
  logger.error({ jobId: job?.id, error: error.message }, 'Job failed');
});
EOF

  echo "generated processor: $folder"
done
