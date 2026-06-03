-- Safe additive migration: new enums and table only; no drops or data changes.

DO $$ BEGIN
  CREATE TYPE "ClientEmailNotificationType" AS ENUM ('TEAM_MEMBER_INVITE', 'DOCUMENT_DEADLINE_REMINDER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClientEmailNotificationStatus" AS ENUM ('SENT', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ClientEmailNotification" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "type" "ClientEmailNotificationType" NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "reminderDaysBefore" INTEGER,
  "documentId" TEXT,
  "targetDeadline" TIMESTAMP(3),
  "subject" TEXT NOT NULL,
  "payload" JSONB,
  "status" "ClientEmailNotificationStatus" NOT NULL DEFAULT 'SENT',
  "errorMessage" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientEmailNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientEmailNotification_clientId_type_recipientEmail_reminderDaysBefore_documentId_targetDeadline_key"
  ON "ClientEmailNotification"("clientId", "type", "recipientEmail", "reminderDaysBefore", "documentId", "targetDeadline");

CREATE INDEX IF NOT EXISTS "ClientEmailNotification_clientId_sentAt_idx"
  ON "ClientEmailNotification"("clientId", "sentAt");

CREATE INDEX IF NOT EXISTS "ClientEmailNotification_type_sentAt_idx"
  ON "ClientEmailNotification"("type", "sentAt");

DO $$ BEGIN
  ALTER TABLE "ClientEmailNotification"
    ADD CONSTRAINT "ClientEmailNotification_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
