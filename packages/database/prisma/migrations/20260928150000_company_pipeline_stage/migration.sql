-- "Pipeline Companies" board: every company sits in one of four columns (New -> In conversation / Follow-up -> Win | Lost).
CREATE TYPE "CompanyPipelineStage" AS ENUM ('NEW', 'IN_CONVERSATION', 'WIN', 'LOST');

ALTER TABLE "companies" ADD COLUMN "pipelineStage" "CompanyPipelineStage" NOT NULL DEFAULT 'NEW';

-- Companies that already are clients were won before the board existed.
UPDATE "companies" SET "pipelineStage" = 'WIN' WHERE "status" = 'ACTIVE_CLIENT';
