-- Sales Lead outreach board schema (idempotent create-only; no data loss).

DO $$ BEGIN
  CREATE TYPE "SalesLeadStage" AS ENUM (
    'NEW', 'EMAIL_1_DUE', 'EMAIL_1_SENT', 'CALL_1_DUE', 'EMAIL_2_DUE', 'EMAIL_2_SENT',
    'CALL_2_DUE', 'BOOKED', 'NEEDS_FOLLOW_UP', 'RECONNECT_LATER', 'BAD_CONTACT',
    'OPTED_OUT', 'CLOSED_SOLD', 'NOT_INTERESTED_TO_NURTURE', 'COMPLETED_NO_RESPONSE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SalesLeadCallResult" AS ENUM (
    'NO_ANSWER', 'LEFT_VOICEMAIL', 'GATEKEEPER', 'SPOKE_WITH_OWNER',
    'CALLBACK_REQUESTED', 'EMAIL_REQUESTED', 'WRONG_NUMBER', 'DISCONNECTED_NUMBER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SalesLeadContactType" AS ENUM ('DIRECT', 'GENERAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SalesLeadSyncStatus" AS ENUM ('NOT_LINKED', 'SYNCED', 'PENDING', 'ERROR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SalesLeadEmailApprovalStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED', 'SENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SalesLead" (
  "id" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "assignedCallerId" TEXT,
  "currentStage" "SalesLeadStage" NOT NULL DEFAULT 'NEW',
  "lastCallResult" "SalesLeadCallResult",
  "nextActionDate" TIMESTAMP(3),
  "lastContactDate" TIMESTAMP(3),
  "state" TEXT,
  "city" TEXT,
  "websiteUrl" TEXT,
  "googleRating" DOUBLE PRECISION,
  "reviewCount" INTEGER,
  "sqftIndoor" INTEGER,
  "sqftOutdoor" INTEGER,
  "sqftCombined" INTEGER,
  "locationType" TEXT,
  "preCallBriefUrl" TEXT,
  "ownerFirstName" TEXT,
  "ownerLastName" TEXT,
  "ownerPhone" TEXT,
  "phoneType" "SalesLeadContactType" NOT NULL DEFAULT 'GENERAL',
  "sourceLinkPhone" TEXT,
  "ownerEmail" TEXT,
  "emailType" "SalesLeadContactType" NOT NULL DEFAULT 'GENERAL',
  "sourceLinkEmail" TEXT,
  "emailApprovalStatus" "SalesLeadEmailApprovalStatus" NOT NULL DEFAULT 'NONE',
  "pendingEmailTemplate" INTEGER,
  "emailDraftSubject" TEXT,
  "emailDraftBody" TEXT,
  "emailApprovedAt" TIMESTAMP(3),
  "emailApprovedBy" TEXT,
  "emailSentAt" TIMESTAMP(3),
  "bookingDateTime" TIMESTAMP(3),
  "notes" TEXT,
  "aiResearchReport" JSONB,
  "mondayBoardId" TEXT,
  "mondayItemId" TEXT,
  "mondayLastSyncedAt" TIMESTAMP(3),
  "syncStatus" "SalesLeadSyncStatus" NOT NULL DEFAULT 'NOT_LINKED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SalesLead_mondayItemId_key" ON "SalesLead"("mondayItemId");
CREATE INDEX IF NOT EXISTS "SalesLead_currentStage_nextActionDate_idx" ON "SalesLead"("currentStage", "nextActionDate");
CREATE INDEX IF NOT EXISTS "SalesLead_assignedCallerId_currentStage_idx" ON "SalesLead"("assignedCallerId", "currentStage");
CREATE INDEX IF NOT EXISTS "SalesLead_syncStatus_updatedAt_idx" ON "SalesLead"("syncStatus", "updatedAt");

DO $$ BEGIN
  ALTER TABLE "SalesLead"
    ADD CONSTRAINT "SalesLead_assignedCallerId_fkey"
    FOREIGN KEY ("assignedCallerId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SalesLeadActivity" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesLeadActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SalesLeadActivity_leadId_createdAt_idx" ON "SalesLeadActivity"("leadId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "SalesLeadActivity"
    ADD CONSTRAINT "SalesLeadActivity_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SalesLeadSyncEvent" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "payload" JSONB,
  "error" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesLeadSyncEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SalesLeadSyncEvent_leadId_createdAt_idx" ON "SalesLeadSyncEvent"("leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "SalesLeadSyncEvent_status_createdAt_idx" ON "SalesLeadSyncEvent"("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "SalesLeadSyncEvent"
    ADD CONSTRAINT "SalesLeadSyncEvent_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
