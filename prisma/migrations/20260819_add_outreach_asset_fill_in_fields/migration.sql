-- Fill-in fields for outreach templates: footer name, calendar link, phone, and guide URL.
ALTER TABLE "OutreachAsset" ADD COLUMN IF NOT EXISTS "senderDisplayName" TEXT;
ALTER TABLE "OutreachAsset" ADD COLUMN IF NOT EXISTS "calendarUrl" TEXT;
ALTER TABLE "OutreachAsset" ADD COLUMN IF NOT EXISTS "senderPhone" TEXT;
ALTER TABLE "OutreachAsset" ADD COLUMN IF NOT EXISTS "guideUrl" TEXT;
