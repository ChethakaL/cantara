-- Safe additive migration: no tables dropped, no data removed.
ALTER TABLE "ClientDocumentStatus" ADD COLUMN IF NOT EXISTS "targetDeadline" TIMESTAMP(3);
ALTER TABLE "ClientProfile" ADD COLUMN IF NOT EXISTS "sectionDeadlines" JSONB;
