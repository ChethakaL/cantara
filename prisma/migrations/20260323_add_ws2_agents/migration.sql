-- AlterTable
ALTER TABLE "ClientProfile"
ADD COLUMN "approvedNormalizedEbitda" DOUBLE PRECISION,
ADD COLUMN "approvedNormalizedEbitdaAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TtmAnalysis"
ADD COLUMN "reportMarkdown" TEXT;

-- CreateEnum
CREATE TYPE "Ws2DerivedAgentId" AS ENUM ('ws2_3_rev_vertical_v1', 'ws2_4_benchmark_v1', 'ws2_5_labor_v1');

-- CreateEnum
CREATE TYPE "Ws2DerivedReportStatus" AS ENUM ('RUNNING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "Ws2RecastAnalysis" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ttmAnalysisId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "TtmRunStatus" NOT NULL DEFAULT 'RUNNING',
    "hitlStatus" "TtmHitlStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "model" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "maxTokens" INTEGER NOT NULL,
    "assumptions" JSONB NOT NULL,
    "reportMarkdown" TEXT,
    "parsedReport" JSONB,
    "workbookKey" TEXT,
    "workbookUrl" TEXT,
    "normalizedEbitda" DOUBLE PRECISION,
    "valuationLow" DOUBLE PRECISION,
    "valuationMid" DOUBLE PRECISION,
    "valuationHigh" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ws2RecastAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ws2RecastFlag" (
    "id" TEXT NOT NULL,
    "recastAnalysisId" TEXT NOT NULL,
    "severity" "TtmFlagSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "payload" JSONB NOT NULL,
    "resolutionStatus" "TtmFlagResolutionStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionAction" "TtmFlagResolutionAction",
    "resolutionNotes" TEXT,
    "overrideAmount" DOUBLE PRECISION,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ws2RecastFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ws2DerivedReport" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ttmAnalysisId" TEXT NOT NULL,
    "recastAnalysisId" TEXT,
    "agentId" "Ws2DerivedAgentId" NOT NULL,
    "status" "Ws2DerivedReportStatus" NOT NULL DEFAULT 'RUNNING',
    "reportMarkdown" TEXT,
    "parsedReport" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ws2DerivedReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ws2RecastAnalysis_ttmAnalysisId_version_key" ON "Ws2RecastAnalysis"("ttmAnalysisId", "version");

-- CreateIndex
CREATE INDEX "Ws2RecastAnalysis_clientId_createdAt_idx" ON "Ws2RecastAnalysis"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "Ws2RecastFlag_recastAnalysisId_resolutionStatus_idx" ON "Ws2RecastFlag"("recastAnalysisId", "resolutionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Ws2DerivedReport_ttmAnalysisId_agentId_key" ON "Ws2DerivedReport"("ttmAnalysisId", "agentId");

-- CreateIndex
CREATE INDEX "Ws2DerivedReport_clientId_createdAt_idx" ON "Ws2DerivedReport"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "Ws2RecastAnalysis" ADD CONSTRAINT "Ws2RecastAnalysis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ws2RecastAnalysis" ADD CONSTRAINT "Ws2RecastAnalysis_ttmAnalysisId_fkey" FOREIGN KEY ("ttmAnalysisId") REFERENCES "TtmAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ws2RecastFlag" ADD CONSTRAINT "Ws2RecastFlag_recastAnalysisId_fkey" FOREIGN KEY ("recastAnalysisId") REFERENCES "Ws2RecastAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ws2DerivedReport" ADD CONSTRAINT "Ws2DerivedReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ws2DerivedReport" ADD CONSTRAINT "Ws2DerivedReport_ttmAnalysisId_fkey" FOREIGN KEY ("ttmAnalysisId") REFERENCES "TtmAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ws2DerivedReport" ADD CONSTRAINT "Ws2DerivedReport_recastAnalysisId_fkey" FOREIGN KEY ("recastAnalysisId") REFERENCES "Ws2RecastAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
