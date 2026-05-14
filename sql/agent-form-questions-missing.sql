-- Additional client portal form questions for WS1 + WS2 agents.
-- Safe to run multiple times.

INSERT INTO "AgentFormQuestion"
  ("id", "agentId", "agentName", "fieldKey", "label", "description", "inputType", "placeholder", "required", "options", "groupKey", "groupLabel", "sortOrder", "isActive")
VALUES
  ('pricing_vertical_businessWebsite', 'pricing_vertical', 'Pricing by Vertical Agent', 'businessWebsite', 'Business website', 'Main business website or pricing/services page used to scrape current service prices.', 'url', 'https://yourbusiness.com/pricing', true, NULL, 'business', 'Business Information', 10, true),

  ('facility_review_businessAddress', 'facility_review', 'Facility Review Agent', 'businessAddress', 'Facility address / location', 'Physical location used for the facility review context.', 'text', '760 Terminal Ave, Vancouver, BC', false, NULL, 'facility_review', 'Facility Review Inputs', 150, true),
  ('facility_review_facilityReviewNotes', 'facility_review', 'Facility Review Agent', 'facilityReviewNotes', 'Facility notes', 'Known maintenance issues, recent upgrades, expansion plans, or context photos may not show.', 'textarea', 'Recent renovations, deferred maintenance, drainage issues, HVAC notes, odor/noise concerns...', false, NULL, 'facility_review', 'Facility Review Inputs', 151, true),

  ('professional_advisors_professionalAdvisorsList', 'professional_advisors', 'Professional Advisors Agent', 'professionalAdvisorsList', 'Professional advisors list', 'One advisor per line. Use: Role | Name | Company | Email | Phone | Willing yes/no/unknown | Notes.', 'textarea', 'Accountant | Jane Smith | Smith CPA | jane@example.com | 555-123-4567 | yes | Handles tax filings\nLawyer | John Lee | Lee Law | john@example.com | 555-222-3333 | unknown | Lease counsel', false, NULL, 'professional_advisors', 'Professional Advisors Inputs', 300, true),

  ('vendor_directory_vendorDirectoryList', 'vendor_directory', 'Software & Vendors Agent', 'vendorDirectoryList', 'Software and vendor list', 'One vendor/tool per line. Use: Tool name | Vendor company | Category | Annual cost | Contract status | Transferable yes/no/unknown | Login access | Notes.', 'textarea', 'Gingr | Gingr | Booking/POS | 3600 | Active | unknown | Owner Only | Booking and customer records\nQuickBooks | Intuit | Accounting | 900 | Month-to-month | yes | Shared | Bookkeeping', false, NULL, 'vendor_directory', 'Software & Vendor Inputs', 310, true)
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
