-- CreateEnum
CREATE TYPE "TtmRunStatus" AS ENUM ('RUNNING', 'HITL_PENDING', 'APPROVED', 'FAILED');

-- CreateEnum
CREATE TYPE "TtmHitlStatus" AS ENUM ('PENDING_REVIEW', 'IN_REVIEW', 'APPROVED');

-- CreateEnum
CREATE TYPE "TtmFlagSection" AS ENUM ('A', 'B', 'C', 'D', 'E');

-- CreateEnum
CREATE TYPE "TtmFlagSeverity" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "TtmFlagResolutionStatus" AS ENUM ('OPEN', 'ACTIONED');

-- CreateEnum
CREATE TYPE "TtmFlagResolutionAction" AS ENUM ('RESOLVE', 'OVERRIDE', 'ESCALATE_CLIENT');

-- CreateEnum
CREATE TYPE "AgentDispatchStatus" AS ENUM ('BLOCKED_HITL', 'READY', 'RELEASED');

-- CreateTable
CREATE TABLE "TtmAnalysis" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "TtmRunStatus" NOT NULL DEFAULT 'RUNNING',
    "hitlStatus" "TtmHitlStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "inputFingerprint" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "maxTokens" INTEGER NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "normalizedData" JSONB,
    "structuredModel" JSONB,
    "ttmSummary" JSONB,
    "annualModel" JSONB,
    "workingCapital" JSONB,
    "dataQualityReport" JSONB,
    "summary" JSONB,
    "errorMessage" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TtmAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TtmFlag" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "section" "TtmFlagSection" NOT NULL,
    "severity" "TtmFlagSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "payload" JSONB NOT NULL,
    "resolutionStatus" "TtmFlagResolutionStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionAction" "TtmFlagResolutionAction",
    "resolutionNotes" TEXT,
    "escalatedRequirementId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TtmFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentDispatchTask" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" "AgentDispatchStatus" NOT NULL,
    "payload" JSONB,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentDispatchTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TtmAnalysis_clientId_createdAt_idx" ON "TtmAnalysis"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "TtmAnalysis_clientId_inputFingerprint_idx" ON "TtmAnalysis"("clientId", "inputFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "TtmAnalysis_clientId_version_key" ON "TtmAnalysis"("clientId", "version");

-- CreateIndex
CREATE INDEX "TtmFlag_analysisId_section_idx" ON "TtmFlag"("analysisId", "section");

-- CreateIndex
CREATE INDEX "TtmFlag_analysisId_resolutionStatus_idx" ON "TtmFlag"("analysisId", "resolutionStatus");

-- CreateIndex
CREATE INDEX "AgentDispatchTask_clientId_status_idx" ON "AgentDispatchTask"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentDispatchTask_analysisId_agentId_key" ON "AgentDispatchTask"("analysisId", "agentId");

-- AddForeignKey
ALTER TABLE "TtmAnalysis" ADD CONSTRAINT "TtmAnalysis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TtmFlag" ADD CONSTRAINT "TtmFlag_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "TtmAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDispatchTask" ADD CONSTRAINT "AgentDispatchTask_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "TtmAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentDispatchTask" ADD CONSTRAINT "AgentDispatchTask_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

