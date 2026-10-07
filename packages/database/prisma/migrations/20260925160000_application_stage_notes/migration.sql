-- CreateTable
CREATE TABLE "application_stage_notes" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "pipelineStageId" TEXT NOT NULL,
    "notes" TEXT,
    "hourlyRate" DECIMAL(10,2),
    "hoursPerDay" INTEGER NOT NULL DEFAULT 8,
    "daysPerMonth" INTEGER NOT NULL DEFAULT 21,
    "feePercent" DECIMAL(5,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_stage_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "application_stage_notes_organisationId_idx" ON "application_stage_notes"("organisationId");

-- CreateIndex
CREATE UNIQUE INDEX "application_stage_notes_applicationId_pipelineStageId_key" ON "application_stage_notes"("applicationId", "pipelineStageId");

-- AddForeignKey
ALTER TABLE "application_stage_notes" ADD CONSTRAINT "application_stage_notes_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_stage_notes" ADD CONSTRAINT "application_stage_notes_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_stage_notes" ADD CONSTRAINT "application_stage_notes_pipelineStageId_fkey" FOREIGN KEY ("pipelineStageId") REFERENCES "pipeline_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

