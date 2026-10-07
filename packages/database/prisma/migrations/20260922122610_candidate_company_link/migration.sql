-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "companyId" TEXT;

-- CreateIndex
CREATE INDEX "candidates_companyId_idx" ON "candidates"("companyId");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
