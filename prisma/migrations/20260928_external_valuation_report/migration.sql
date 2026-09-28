CREATE TABLE "ExternalValuationReport" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "reportJson" JSONB NOT NULL,
  "aiProvider" TEXT NOT NULL DEFAULT 'bedrock',
  "aiModel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalValuationReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExternalValuationReport_clientId_createdAt_idx" ON "ExternalValuationReport"("clientId", "createdAt");
ALTER TABLE "ExternalValuationReport" ADD CONSTRAINT "ExternalValuationReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
