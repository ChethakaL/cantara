CREATE TABLE IF NOT EXISTS "RealEstateAppraisalReport" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "markdown" TEXT NOT NULL,
  "documentNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RealEstateAppraisalReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RealEstateAppraisalReport_clientId_createdAt_idx" ON "RealEstateAppraisalReport"("clientId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "RealEstateAppraisalReport" ADD CONSTRAINT "RealEstateAppraisalReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "ClientProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
