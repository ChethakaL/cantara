CREATE TABLE "OutreachAsset" (
  "id" TEXT NOT NULL,
  "senderUserId" TEXT,
  "touch" INTEGER NOT NULL,
  "contactType" "SalesLeadContactType" NOT NULL,
  "assetType" TEXT NOT NULL DEFAULT 'EMAIL',
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutreachAsset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OutreachAsset_touch_contactType_active_idx" ON "OutreachAsset"("touch", "contactType", "active");
CREATE INDEX "OutreachAsset_senderUserId_touch_contactType_active_idx" ON "OutreachAsset"("senderUserId", "touch", "contactType", "active");
ALTER TABLE "OutreachAsset" ADD CONSTRAINT "OutreachAsset_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
