-- Chat attachments on ChatMessage (idempotent; no data loss).
DO $$ BEGIN
  ALTER TABLE "ChatMessage" ADD COLUMN "attachmentUrl" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChatMessage" ADD COLUMN "attachmentName" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChatMessage" ADD COLUMN "attachmentMimeType" TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChatMessage" ADD COLUMN "attachmentSize" INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
