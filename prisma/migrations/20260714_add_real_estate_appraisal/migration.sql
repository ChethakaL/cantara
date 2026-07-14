CREATE TABLE "RealEstateAppraisalReport" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "markdown" TEXT NOT NULL,
  "documentNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RealEstateAppraisalReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RealEstateAppraisalReport_clientId_createdAt_idx" ON "RealEstateAppraisalReport"("clientId", "createdAt");
ALTER TABLE "RealEstateAppraisalReport" ADD CONSTRAINT "RealEstateAppraisalReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
