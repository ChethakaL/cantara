-- Add AI provider/model tracking for agent run history and comparison.

ALTER TABLE "LeaseAnalysis" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT NOT NULL DEFAULT 'bedrock';
ALTER TABLE "LeaseAnalysis" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;

ALTER TABLE "ContractAnalysis" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT NOT NULL DEFAULT 'bedrock';
ALTER TABLE "ContractAnalysis" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;

ALTER TABLE "CompetitorAnalysis" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT NOT NULL DEFAULT 'bedrock';
ALTER TABLE "CompetitorAnalysis" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;

ALTER TABLE "EmployeeObligationsReport" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT NOT NULL DEFAULT 'bedrock';
ALTER TABLE "EmployeeObligationsReport" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;

ALTER TABLE "RealEstateAppraisalReport" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT NOT NULL DEFAULT 'bedrock';
ALTER TABLE "RealEstateAppraisalReport" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;

ALTER TABLE "OwnershipVerificationReport" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT NOT NULL DEFAULT 'bedrock';
ALTER TABLE "OwnershipVerificationReport" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;

ALTER TABLE "PermitsZoningReport" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT NOT NULL DEFAULT 'bedrock';
ALTER TABLE "PermitsZoningReport" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;

ALTER TABLE "LegalEntitySearchReport" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT NOT NULL DEFAULT 'bedrock';
ALTER TABLE "LegalEntitySearchReport" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;

ALTER TABLE "TaxLiabilityReport" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT NOT NULL DEFAULT 'bedrock';
ALTER TABLE "TaxLiabilityReport" ADD COLUMN IF NOT EXISTS "aiModel" TEXT;

ALTER TABLE "TtmAnalysis" ADD COLUMN IF NOT EXISTS "aiProvider" TEXT NOT NULL DEFAULT 'bedrock';
