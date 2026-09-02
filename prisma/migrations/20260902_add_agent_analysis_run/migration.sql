-- CreateTable
CREATE TABLE "AgentAnalysisRun" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentAnalysisRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentAnalysisRun_clientId_agentKey_createdAt_idx" ON "AgentAnalysisRun"("clientId", "agentKey", "createdAt");

-- AddForeignKey
ALTER TABLE "AgentAnalysisRun" ADD CONSTRAINT "AgentAnalysisRun_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
