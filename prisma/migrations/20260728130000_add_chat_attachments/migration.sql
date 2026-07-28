ALTER TABLE "ChatMessage"
  ADD COLUMN "attachmentUrl" TEXT,
  ADD COLUMN "attachmentName" TEXT,
  ADD COLUMN "attachmentMimeType" TEXT,
  ADD COLUMN "attachmentSize" INTEGER;
