-- Add address and business category fields per competitor (5 slots) for both
-- Competitor Analysis and Competitive Pricing agents on the client portal.
-- Safe to run multiple times (ON CONFLICT DO UPDATE).

INSERT INTO "AgentFormQuestion"
  ("id", "agentId", "agentName", "fieldKey", "label", "description", "inputType", "placeholder", "required", "options", "groupKey", "groupLabel", "sortOrder", "isActive")
VALUES
  -- Competitor Analysis: address + category per competitor
  ('competitor_analysis_competitor1Address', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor1Address', 'Competitor 1 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'competitors', 'Competitor Inputs', 143, true),
  ('competitor_analysis_competitor1Category', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor1Category', 'Competitor 1 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'competitors', 'Competitor Inputs', 143, true),
  ('competitor_analysis_competitor2Address', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor2Address', 'Competitor 2 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'competitors', 'Competitor Inputs', 145, true),
  ('competitor_analysis_competitor2Category', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor2Category', 'Competitor 2 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'competitors', 'Competitor Inputs', 145, true),
  ('competitor_analysis_competitor3Address', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor3Address', 'Competitor 3 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'competitors', 'Competitor Inputs', 147, true),
  ('competitor_analysis_competitor3Category', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor3Category', 'Competitor 3 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'competitors', 'Competitor Inputs', 147, true),
  ('competitor_analysis_competitor4Address', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor4Address', 'Competitor 4 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'competitors', 'Competitor Inputs', 149, true),
  ('competitor_analysis_competitor4Category', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor4Category', 'Competitor 4 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'competitors', 'Competitor Inputs', 149, true),
  ('competitor_analysis_competitor5Address', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor5Address', 'Competitor 5 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'competitors', 'Competitor Inputs', 151, true),
  ('competitor_analysis_competitor5Category', 'competitor_analysis', 'Competitor Analysis Agent', 'competitor5Category', 'Competitor 5 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'competitors', 'Competitor Inputs', 151, true),

  -- Competitive Pricing: address + category per competitor
  ('pricing_analysis_competitor1Address', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor1Address', 'Competitor 1 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 501, true),
  ('pricing_analysis_competitor1Category', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor1Category', 'Competitor 1 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 501, true),
  ('pricing_analysis_competitor2Address', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor2Address', 'Competitor 2 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 503, true),
  ('pricing_analysis_competitor2Category', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor2Category', 'Competitor 2 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 503, true),
  ('pricing_analysis_competitor3Address', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor3Address', 'Competitor 3 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 505, true),
  ('pricing_analysis_competitor3Category', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor3Category', 'Competitor 3 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 505, true),
  ('pricing_analysis_competitor4Address', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor4Address', 'Competitor 4 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 507, true),
  ('pricing_analysis_competitor4Category', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor4Category', 'Competitor 4 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 507, true),
  ('pricing_analysis_competitor5Address', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor5Address', 'Competitor 5 address', NULL, 'text', '123 Main St, City, State', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 509, true),
  ('pricing_analysis_competitor5Category', 'pricing_analysis', 'Competitive Pricing Analysis Agent', 'competitor5Category', 'Competitor 5 business category', NULL, 'text', 'Boarding, Daycare, Grooming', false, NULL, 'pricing_competitors', 'Competitor Pricing Inputs', 509, true)
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
