CREATE TABLE IF NOT EXISTS "AdvisorMailConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'GMAIL',
  "composioUserId" TEXT NOT NULL,
  "connectedAccountId" TEXT NOT NULL,
  "email" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdvisorMailConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdvisorMailConnection_userId_key" ON "AdvisorMailConnection"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "AdvisorMailConnection_composioUserId_key" ON "AdvisorMailConnection"("composioUserId");
CREATE INDEX IF NOT EXISTS "AdvisorMailConnection_connectedAccountId_idx" ON "AdvisorMailConnection"("connectedAccountId");

DO $$ BEGIN
  ALTER TABLE "AdvisorMailConnection"
    ADD CONSTRAINT "AdvisorMailConnection_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
