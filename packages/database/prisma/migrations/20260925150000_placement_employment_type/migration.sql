-- Employment type per placement (Active Employees): PERMANENT | TEMPORARY, default PERMANENT for existing rows.
-- (The index statements Prisma's diff also emitted are already applied by 20260925130000_perf_indexes.)

-- CreateEnum
CREATE TYPE "PlacementEmploymentType" AS ENUM ('PERMANENT', 'TEMPORARY');

-- AlterTable
ALTER TABLE "placements" ADD COLUMN     "employmentType" "PlacementEmploymentType" NOT NULL DEFAULT 'PERMANENT';
