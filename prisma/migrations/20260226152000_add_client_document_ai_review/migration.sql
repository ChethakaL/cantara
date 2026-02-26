-- Add lightweight AI review metadata fields on uploaded documents.
ALTER TABLE "ClientDocument"
ADD COLUMN "aiReviewStatus" TEXT,
ADD COLUMN "aiReviewSummary" TEXT,
ADD COLUMN "aiReviewFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "aiDetectedType" TEXT,
ADD COLUMN "aiBusinessNameMatch" BOOLEAN,
ADD COLUMN "aiReviewedAt" TIMESTAMP(3);
