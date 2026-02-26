-- Add lightweight AI review metadata fields on uploaded documents.
-- Use IF NOT EXISTS so migration is idempotent when columns already exist (e.g. after partial run).
ALTER TABLE "ClientDocument" ADD COLUMN IF NOT EXISTS "aiReviewStatus" TEXT;
ALTER TABLE "ClientDocument" ADD COLUMN IF NOT EXISTS "aiReviewSummary" TEXT;
ALTER TABLE "ClientDocument" ADD COLUMN IF NOT EXISTS "aiReviewFlags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ClientDocument" ADD COLUMN IF NOT EXISTS "aiDetectedType" TEXT;
ALTER TABLE "ClientDocument" ADD COLUMN IF NOT EXISTS "aiBusinessNameMatch" BOOLEAN;
ALTER TABLE "ClientDocument" ADD COLUMN IF NOT EXISTS "aiReviewedAt" TIMESTAMP(3);
