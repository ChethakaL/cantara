CREATE TABLE IF NOT EXISTS "ClientTimelineStage" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "stageKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "manualOverride" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "completedBy" TEXT,
  "notesText" TEXT,
  "notesFileName" TEXT,
  "notesUploadedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClientTimelineStage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClientTimelineStage_clientId_stageKey_key" ON "ClientTimelineStage"("clientId", "stageKey");
CREATE INDEX IF NOT EXISTS "ClientTimelineStage_clientId_updatedAt_idx" ON "ClientTimelineStage"("clientId", "updatedAt");

DO $$ BEGIN
  ALTER TABLE "ClientTimelineStage"
    ADD CONSTRAINT "ClientTimelineStage_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
