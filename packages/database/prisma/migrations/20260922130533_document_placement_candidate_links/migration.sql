-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "candidateId" TEXT,
ADD COLUMN     "placementId" TEXT;

-- CreateIndex
CREATE INDEX "documents_placementId_idx" ON "documents"("placementId");

-- CreateIndex
CREATE INDEX "documents_candidateId_idx" ON "documents"("candidateId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "placements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
