-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "interestedJobId" TEXT;

-- CreateIndex
CREATE INDEX "candidates_interestedJobId_idx" ON "candidates"("interestedJobId");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_interestedJobId_fkey" FOREIGN KEY ("interestedJobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
