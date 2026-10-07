-- A pipeline scheme decides what its placed candidates become: permanent or temporary employees.
ALTER TABLE "pipelines" ADD COLUMN "employmentType" "PlacementEmploymentType" NOT NULL DEFAULT 'PERMANENT';
