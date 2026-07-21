-- Safe copy updates only (no deletes / no schema changes).
-- Fixes Required Info helper text that is served from AgentFormQuestion.description.

UPDATE "AgentFormQuestion"
SET
  "description" = 'Two options to provide this information: 1. fill in the form below; 2. provide the information in an Excel file. Please note that we have provided a downloadable Excel template as a reference if required.',
  "placeholder" = 'Accountant | Jane Smith | Smith CPA | jane@example.com | 555-123-4567 | Handles tax filings
Lawyer | John Lee | Lee Law | john@example.com | 555-222-3333 | Lease counsel',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "agentId" = 'professional_advisors'
  AND "fieldKey" = 'professionalAdvisorsList';

UPDATE "AgentFormQuestion"
SET
  "description" = 'Two options to provide this information: 1. fill in the form below; 2. provide the information in an Excel file. Please note that we have provided a downloadable Excel template as a reference if required.',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "agentId" = 'vendor_directory'
  AND "fieldKey" = 'vendorDirectoryList';
