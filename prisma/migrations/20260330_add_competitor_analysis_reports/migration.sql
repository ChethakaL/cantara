CREATE TABLE "CompetitorAnalysis" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "report" TEXT NOT NULL,
  "parsed" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompetitorAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompetitorAnalysis_clientId_createdAt_idx" ON "CompetitorAnalysis"("clientId", "createdAt");

ALTER TABLE "CompetitorAnalysis"
ADD CONSTRAINT "CompetitorAnalysis_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
