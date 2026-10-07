-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "calendar_events_status_startAt_reminderSentAt_idx" ON "calendar_events"("status", "startAt", "reminderSentAt");
