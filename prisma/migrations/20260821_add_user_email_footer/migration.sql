ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailFooterName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailFooterTitle" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailFooterPhone" TEXT;

-- Prefer advisor-level footer settings over lead-level position/phone columns.
ALTER TABLE "SalesLead" DROP COLUMN IF EXISTS "businessPosition";
ALTER TABLE "SalesLead" DROP COLUMN IF EXISTS "officePhone";

-- Replace hardcoded email signatures with [Footer] so drafts use the advisor's
-- saved Sender Footer (name / title / phone) instead of stacking a second one.
-- Covers both:
--   Name\nTitle with Cantara...\nphone
--   Name\nBusiness Development\nCantara Pet Business Advisors\n[phone]
UPDATE "OutreachAsset"
SET "body" = regexp_replace(
  "body",
  E'\\n+(Chethaka Lakshitha|Craig Pollack|Gabriela(?: Torres| \\[Last Name\\])?|Stephanie Johnson)\\r?\\n(?:Business Development\\r?\\n)?(?:(?:Lead at |CEO )?Cantara Pet Business Advisors)\\r?\\n(?:\\(?206\\)?[ \\-]?202[ \\-]?5014|\\[phone\\])\\s*$',
  E'\n\n[Footer]',
  'gi'
)
WHERE "assetType" = 'EMAIL'
  AND "body" ~* E'(Chethaka Lakshitha|Craig Pollack|Gabriela|Stephanie Johnson)';

-- Normalize any earlier {{senderFooter}} tokens to the same [Footer] placeholder.
UPDATE "OutreachAsset"
SET "body" = regexp_replace("body", E'\\{\\{\\s*senderFooter\\s*\\}\\}', '[Footer]', 'gi')
WHERE "assetType" = 'EMAIL'
  AND "body" ~* E'\\{\\{\\s*senderFooter\\s*\\}\\}';

-- Strip the same hardcoded signatures from already-saved lead drafts so the
-- UI no longer shows template footer + Sender Footer stacked together.
UPDATE "SalesLead"
SET "emailDraftBody" = regexp_replace(
  "emailDraftBody",
  E'\\n+(Chethaka Lakshitha|Craig Pollack|Gabriela(?: Torres| \\[Last Name\\])?|Stephanie Johnson)\\r?\\n(?:Business Development\\r?\\n)?(?:(?:Lead at |CEO )?Cantara Pet Business Advisors)\\r?\\n(?:\\(?206\\)?[ \\-]?202[ \\-]?5014|\\[phone\\])\\s*',
  E'\n\n',
  'gi'
)
WHERE "emailDraftBody" IS NOT NULL
  AND "emailDraftBody" ~* E'(Chethaka Lakshitha|Craig Pollack|Gabriela|Stephanie Johnson)';
