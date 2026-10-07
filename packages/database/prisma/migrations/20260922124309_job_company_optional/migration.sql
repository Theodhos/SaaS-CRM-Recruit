-- DropForeignKey
ALTER TABLE "jobs" DROP CONSTRAINT "jobs_companyId_fkey";

-- AlterTable
ALTER TABLE "jobs" ALTER COLUMN "companyId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
