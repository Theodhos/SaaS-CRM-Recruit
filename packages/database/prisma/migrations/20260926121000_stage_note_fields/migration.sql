-- Per-stage structured record (the stage's own form) next to the free-text notes and pay figures.
ALTER TABLE "application_stage_notes" ADD COLUMN "fields" JSONB NOT NULL DEFAULT '{}';
