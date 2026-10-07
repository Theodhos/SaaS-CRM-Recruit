-- A job says what the work is, what the candidate will do, what is asked of them (incl. years of experience)
-- and what the pay package is beyond the salary range.
ALTER TABLE "jobs" ADD COLUMN "responsibilities" TEXT;
ALTER TABLE "jobs" ADD COLUMN "requirements" TEXT;
ALTER TABLE "jobs" ADD COLUMN "experienceYearsMin" INTEGER;
ALTER TABLE "jobs" ADD COLUMN "experienceYearsMax" INTEGER;
ALTER TABLE "jobs" ADD COLUMN "compensationPackage" TEXT;
