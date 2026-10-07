-- CreateTable
CREATE TABLE "pipeline_stage_checklist_items" (
    "id" TEXT NOT NULL,
    "pipelineStageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_stage_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_checklist_items" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipeline_stage_checklist_items_pipelineStageId_idx" ON "pipeline_stage_checklist_items"("pipelineStageId");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_stage_checklist_items_pipelineStageId_order_key" ON "pipeline_stage_checklist_items"("pipelineStageId", "order");

-- CreateIndex
CREATE INDEX "application_checklist_items_applicationId_idx" ON "application_checklist_items"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "application_checklist_items_applicationId_checklistItemId_key" ON "application_checklist_items"("applicationId", "checklistItemId");

-- AddForeignKey
ALTER TABLE "pipeline_stage_checklist_items" ADD CONSTRAINT "pipeline_stage_checklist_items_pipelineStageId_fkey" FOREIGN KEY ("pipelineStageId") REFERENCES "pipeline_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_checklist_items" ADD CONSTRAINT "application_checklist_items_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_checklist_items" ADD CONSTRAINT "application_checklist_items_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "pipeline_stage_checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
