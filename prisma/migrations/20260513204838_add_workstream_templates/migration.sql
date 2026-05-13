ALTER TABLE "ClientProfile" ADD COLUMN "customWorkstreamId" TEXT;

CREATE TABLE "WorkstreamTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkstreamTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkstreamTemplateAgent" (
    "id" TEXT NOT NULL,
    "workstreamId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "documentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkstreamTemplateAgent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkstreamTemplate_name_key" ON "WorkstreamTemplate"("name");
CREATE INDEX "ClientProfile_customWorkstreamId_idx" ON "ClientProfile"("customWorkstreamId");
CREATE INDEX "WorkstreamTemplateAgent_workstreamId_idx" ON "WorkstreamTemplateAgent"("workstreamId");
CREATE UNIQUE INDEX "WorkstreamTemplateAgent_workstreamId_agentId_key" ON "WorkstreamTemplateAgent"("workstreamId", "agentId");

ALTER TABLE "ClientProfile" ADD CONSTRAINT "ClientProfile_customWorkstreamId_fkey" FOREIGN KEY ("customWorkstreamId") REFERENCES "WorkstreamTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkstreamTemplateAgent" ADD CONSTRAINT "WorkstreamTemplateAgent_workstreamId_fkey" FOREIGN KEY ("workstreamId") REFERENCES "WorkstreamTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ClientWorkstreamAgent" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "documentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientWorkstreamAgent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientWorkstreamAgent_clientId_idx" ON "ClientWorkstreamAgent"("clientId");
CREATE UNIQUE INDEX "ClientWorkstreamAgent_clientId_agentId_key" ON "ClientWorkstreamAgent"("clientId", "agentId");

ALTER TABLE "ClientWorkstreamAgent" ADD CONSTRAINT "ClientWorkstreamAgent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AgentDocumentRequirement" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "documentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentDocumentRequirement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentDocumentRequirement_agentId_key" ON "AgentDocumentRequirement"("agentId");

CREATE TABLE "AppSecret" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSecret_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppSecret_key_key" ON "AppSecret"("key");
