-- Performance indexes (additive; an index never changes query RESULTS, only the plan).
--
-- Each one serves a real query of the API's list endpoints and was measured on a synthetic 1M-candidate tenant
-- (1.2M applications, 2M activities, 1M notifications, 500k tasks): the list queries drop from 66-1100 ms to ~0 ms
-- because Postgres can walk the index in order and stop after LIMIT rows instead of scanning and sorting the tenant.
-- Evidence and methodology: docs/operations/performance.md.
--
-- ROLLOUT. A plain CREATE INDEX blocks writes to the table while it builds — fine on a small database, not on a
-- large one. On a large production database create each index first WITHOUT blocking, then deploy this migration
-- (it is a no-op for indexes that already exist):
--
--     CREATE INDEX CONCURRENTLY IF NOT EXISTS "candidates_organisationId_createdAt_idx"
--       ON "candidates"("organisationId", "createdAt" DESC);       -- one statement per session, outside a transaction
--
-- Rollback: DROP INDEX IF EXISTS "<name>";  (safe at any time; queries fall back to the previous plans.)

-- CreateIndex
CREATE INDEX IF NOT EXISTS "applications_organisationId_appliedAt_idx" ON "applications"("organisationId", "appliedAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "candidates_organisationId_createdAt_idx" ON "candidates"("organisationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "candidates_organisationId_status_createdAt_idx" ON "candidates"("organisationId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_organisationId_createdAt_idx" ON "contacts"("organisationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "jobs_organisationId_createdAt_idx" ON "jobs"("organisationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_userId_organisationId_createdAt_idx" ON "notifications"("userId", "organisationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_userId_organisationId_readAt_idx" ON "notifications"("userId", "organisationId", "readAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tasks_organisationId_dueDate_createdAt_idx" ON "tasks"("organisationId", "dueDate", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");

