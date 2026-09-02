-- Idempotent: AgentAnalysisRun table for agent run history and comparison.
CREATE TABLE IF NOT EXISTS "AgentAnalysisRun" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "fileName" TEXT,
    "report" JSONB NOT NULL DEFAULT '{}',
    "markdown" TEXT,
    "documentNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "aiProvider" TEXT NOT NULL DEFAULT 'bedrock',
    "aiModel" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgentAnalysisRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgentAnalysisRun_clientId_agentKey_createdAt_idx"
  ON "AgentAnalysisRun"("clientId", "agentKey", "createdAt");

DO $$ BEGIN
  ALTER TABLE "AgentAnalysisRun"
    ADD CONSTRAINT "AgentAnalysisRun_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
