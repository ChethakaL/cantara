-- Idempotent: add SalesLead.stageStartDate for stage aging / column display.
DO $$ BEGIN
  ALTER TABLE "SalesLead" ADD COLUMN "stageStartDate" TIMESTAMP(3);
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;
