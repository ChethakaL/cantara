-- Client portal agent form questions.
-- Run this once in Postgres. The UI reads this table dynamically and de-dupes repeated field keys.

CREATE TABLE IF NOT EXISTS "AgentFormQuestion" (
  "id" TEXT PRIMARY KEY,
  "agentId" TEXT NOT NULL,
  "agentName" TEXT NOT NULL,
  "fieldKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "inputType" TEXT NOT NULL DEFAULT 'text',
  "placeholder" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB,
  "groupKey" TEXT,
  "groupLabel" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentFormQuestion_agentId_fieldKey_key"
  ON "AgentFormQuestion" ("agentId", "fieldKey");
CREATE INDEX IF NOT EXISTS "AgentFormQuestion_agentId_idx"
  ON "AgentFormQuestion" ("agentId");
CREATE INDEX IF NOT EXISTS "AgentFormQuestion_fieldKey_idx"
  ON "AgentFormQuestion" ("fieldKey");

INSERT INTO "AgentFormQuestion"
  ("id", "agentId", "agentName", "fieldKey", "label", "description", "inputType", "placeholder", "required", "options", "groupKey", "groupLabel", "sortOrder", "isActive")
VALUES
  ('digital_presence_businessWebsite', 'digital_presence', 'Digital Presence Agent', 'businessWebsite', 'Business website', 'Main business website or most relevant service/pricing page.', 'url', 'https://yourbusiness.com', true, NULL, 'business', 'Business Information', 10, true),
  ('competitor_analysis_businessWebsite', 'competitor_analysis', 'Competitor Analysis Agent', 'businessWebsite', 'Business website', 'Main business website or most relevant service/pricing page.', 'url', 'https://yourbusiness.com', true, NULL, 'business', 'Business Information', 10, true),
  ('pricing_analysis_businessWebsite', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'businessWebsite', 'Business website', 'Main business website or most relevant service/pricing page.', 'url', 'https://yourbusiness.com/pricing', true, NULL, 'business', 'Business Information', 10, true),

  ('digital_presence_googleBusinessProfileUrl', 'digital_presence', 'Digital Presence Agent', 'googleBusinessProfileUrl', 'Google Business Profile URL', 'Public Google Business Profile or Maps listing URL.', 'url', 'https://maps.google.com/...', false, NULL, 'digital_presence', 'Digital Presence Inputs', 20, true),
  ('digital_presence_googleBusinessLocations', 'digital_presence', 'Digital Presence Agent', 'googleBusinessLocations', 'Google Business locations', 'List all Google Business Profile locations if there are multiple branches.', 'textarea', 'Downtown profile URL, North Shore profile URL...', false, NULL, 'digital_presence', 'Digital Presence Inputs', 30, true),
  ('digital_presence_facebookHandle', 'digital_presence', 'Digital Presence Agent', 'facebookHandle', 'Facebook page', NULL, 'text', 'https://facebook.com/yourbusiness or @handle', false, NULL, 'digital_presence', 'Digital Presence Inputs', 40, true),
  ('digital_presence_instagramHandle', 'digital_presence', 'Digital Presence Agent', 'instagramHandle', 'Instagram profile', NULL, 'text', 'https://instagram.com/yourbusiness or @handle', false, NULL, 'digital_presence', 'Digital Presence Inputs', 50, true),
  ('digital_presence_tiktokHandle', 'digital_presence', 'Digital Presence Agent', 'tiktokHandle', 'TikTok profile', NULL, 'text', 'https://tiktok.com/@yourbusiness or @handle', false, NULL, 'digital_presence', 'Digital Presence Inputs', 60, true),
  ('digital_presence_bookingPlatformUrl', 'digital_presence', 'Digital Presence Agent', 'bookingPlatformUrl', 'Booking platform URL', 'Online booking, Gingr, Paw Partner, PetExec, or similar public booking link.', 'url', 'https://...', false, NULL, 'digital_presence', 'Digital Presence Inputs', 70, true),
  ('digital_presence_yelpUrl', 'digital_presence', 'Digital Presence Agent', 'yelpUrl', 'Yelp profile', NULL, 'url', 'https://www.yelp.com/biz/...', false, NULL, 'digital_presence', 'Digital Presence Inputs', 80, true),
  ('digital_presence_nextdoorUrl', 'digital_presence', 'Digital Presence Agent', 'nextdoorUrl', 'Nextdoor profile', NULL, 'url', 'https://nextdoor.com/pages/...', false, NULL, 'digital_presence', 'Digital Presence Inputs', 90, true),
  ('digital_presence_linkedinUrl', 'digital_presence', 'Digital Presence Agent', 'linkedinUrl', 'LinkedIn profile', NULL, 'url', 'https://linkedin.com/company/...', false, NULL, 'digital_presence', 'Digital Presence Inputs', 100, true),
  ('digital_presence_glassdoorUrl', 'digital_presence', 'Digital Presence Agent', 'glassdoorUrl', 'Glassdoor profile', NULL, 'url', 'https://glassdoor.com/...', false, NULL, 'digital_presence', 'Digital Presence Inputs', 110, true),
  ('digital_presence_bbbUrl', 'digital_presence', 'Digital Presence Agent', 'bbbUrl', 'BBB profile', NULL, 'url', 'https://www.bbb.org/...', false, NULL, 'digital_presence', 'Digital Presence Inputs', 120, true),

  ('competitor_analysis_businessAddress', 'competitor_analysis', 'Competitor Analysis Agent', 'businessAddress', 'Business address / market area', 'Primary city/neighborhood used to judge local competitors.', 'text', 'Vancouver, BC', false, NULL, 'competitors', 'Competitor Inputs', 130, true),
  ('competitor_analysis_businessCategory', 'competitor_analysis', 'Competitor Analysis Agent', 'businessCategory', 'Business category', 'Short category used for competitor discovery.', 'text', 'Dog daycare and boarding', false, NULL, 'competitors', 'Competitor Inputs', 140, true),

  ('competitor_analysis_competitor1Name', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor1Name', 'Competitor 1 name', NULL, 'text', 'Competitor name', true, NULL, 'competitors', 'Competitor Inputs', 142, true),
  ('competitor_analysis_competitor1Website', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor1Website', 'Competitor 1 website', NULL, 'url', 'https://competitor.com', true, NULL, 'competitors', 'Competitor Inputs', 143, true),
  ('competitor_analysis_competitor1Address', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor1Address', 'Competitor 1 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'competitors', 'Competitor Inputs', 144, true),
  ('competitor_analysis_competitor1Category', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor1Category', 'Competitor 1 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'competitors', 'Competitor Inputs', 145, true),
  ('competitor_analysis_competitor2Name', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor2Name', 'Competitor 2 name', NULL, 'text', 'Competitor name', true, NULL, 'competitors', 'Competitor Inputs', 152, true),
  ('competitor_analysis_competitor2Website', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor2Website', 'Competitor 2 website', NULL, 'url', 'https://competitor.com', true, NULL, 'competitors', 'Competitor Inputs', 153, true),
  ('competitor_analysis_competitor2Address', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor2Address', 'Competitor 2 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'competitors', 'Competitor Inputs', 154, true),
  ('competitor_analysis_competitor2Category', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor2Category', 'Competitor 2 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'competitors', 'Competitor Inputs', 155, true),
  ('competitor_analysis_competitor3Name', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor3Name', 'Competitor 3 name', NULL, 'text', 'Competitor name', true, NULL, 'competitors', 'Competitor Inputs', 162, true),
  ('competitor_analysis_competitor3Website', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor3Website', 'Competitor 3 website', NULL, 'url', 'https://competitor.com', true, NULL, 'competitors', 'Competitor Inputs', 163, true),
  ('competitor_analysis_competitor3Address', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor3Address', 'Competitor 3 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'competitors', 'Competitor Inputs', 164, true),
  ('competitor_analysis_competitor3Category', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor3Category', 'Competitor 3 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'competitors', 'Competitor Inputs', 165, true),
  ('competitor_analysis_competitor4Name', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor4Name', 'Competitor 4 name', NULL, 'text', 'Competitor name', true, NULL, 'competitors', 'Competitor Inputs', 172, true),
  ('competitor_analysis_competitor4Website', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor4Website', 'Competitor 4 website', NULL, 'url', 'https://competitor.com', true, NULL, 'competitors', 'Competitor Inputs', 173, true),
  ('competitor_analysis_competitor4Address', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor4Address', 'Competitor 4 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'competitors', 'Competitor Inputs', 174, true),
  ('competitor_analysis_competitor4Category', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor4Category', 'Competitor 4 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'competitors', 'Competitor Inputs', 175, true),
  ('competitor_analysis_competitor5Name', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor5Name', 'Competitor 5 name', NULL, 'text', 'Competitor name', true, NULL, 'competitors', 'Competitor Inputs', 182, true),
  ('competitor_analysis_competitor5Website', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor5Website', 'Competitor 5 website', NULL, 'url', 'https://competitor.com', true, NULL, 'competitors', 'Competitor Inputs', 183, true),
  ('competitor_analysis_competitor5Address', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor5Address', 'Competitor 5 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'competitors', 'Competitor Inputs', 184, true),
  ('competitor_analysis_competitor5Category', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor5Category', 'Competitor 5 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'competitors', 'Competitor Inputs', 185, true),

  ('pricing_analysis_competitor1Name', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor1Name', 'Competitor 1 name', NULL, 'text', 'Competitor name', true, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 500, true),
  ('pricing_analysis_competitor1Website', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor1Website', 'Competitor 1 website', NULL, 'url', 'https://competitor.com/pricing', true, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 501, true),
  ('pricing_analysis_competitor1Address', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor1Address', 'Competitor 1 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 502, true),
  ('pricing_analysis_competitor1Category', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor1Category', 'Competitor 1 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 503, true),
  ('pricing_analysis_competitor2Name', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor2Name', 'Competitor 2 name', NULL, 'text', 'Competitor name', true, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 510, true),
  ('pricing_analysis_competitor2Website', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor2Website', 'Competitor 2 website', NULL, 'url', 'https://competitor.com/pricing', true, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 511, true),
  ('pricing_analysis_competitor2Address', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor2Address', 'Competitor 2 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 512, true),
  ('pricing_analysis_competitor2Category', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor2Category', 'Competitor 2 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 513, true),
  ('pricing_analysis_competitor3Name', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor3Name', 'Competitor 3 name', NULL, 'text', 'Competitor name', true, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 520, true),
  ('pricing_analysis_competitor3Website', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor3Website', 'Competitor 3 website', NULL, 'url', 'https://competitor.com/pricing', true, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 521, true),
  ('pricing_analysis_competitor3Address', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor3Address', 'Competitor 3 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 522, true),
  ('pricing_analysis_competitor3Category', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor3Category', 'Competitor 3 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 523, true),
  ('pricing_analysis_competitor4Name', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor4Name', 'Competitor 4 name', NULL, 'text', 'Competitor name', true, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 530, true),
  ('pricing_analysis_competitor4Website', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor4Website', 'Competitor 4 website', NULL, 'url', 'https://competitor.com/pricing', true, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 531, true),
  ('pricing_analysis_competitor4Address', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor4Address', 'Competitor 4 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 532, true),
  ('pricing_analysis_competitor4Category', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor4Category', 'Competitor 4 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 533, true),
  ('pricing_analysis_competitor5Name', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor5Name', 'Competitor 5 name', NULL, 'text', 'Competitor name', true, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 540, true),
  ('pricing_analysis_competitor5Website', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor5Website', 'Competitor 5 website', NULL, 'url', 'https://competitor.com/pricing', true, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 541, true),
  ('pricing_analysis_competitor5Address', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor5Address', 'Competitor 5 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 542, true),
  ('pricing_analysis_competitor5Category', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor5Category', 'Competitor 5 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 543, true)
ON CONFLICT ("agentId", "fieldKey") DO UPDATE SET
  "agentName" = EXCLUDED."agentName",
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "inputType" = EXCLUDED."inputType",
  "placeholder" = EXCLUDED."placeholder",
  "required" = EXCLUDED."required",
  "options" = EXCLUDED."options",
  "groupKey" = EXCLUDED."groupKey",
  "groupLabel" = EXCLUDED."groupLabel",
  "sortOrder" = EXCLUDED."sortOrder",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;
