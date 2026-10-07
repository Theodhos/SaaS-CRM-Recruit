-- What the Pipeline Companies pop-up keeps per company: the History text of each stage (with dates) and the pay calculation.
ALTER TABLE "companies" ADD COLUMN "pipelineRecord" JSONB NOT NULL DEFAULT '{}';
