-- Safe copy updates only (no deletes / no schema changes).

-- Professional Advisors: remove Willing only; keep original pipe-format helper text.
UPDATE "AgentFormQuestion"
SET
  "description" = 'One advisor per line. Use: Role | Name | Company | Email | Phone | Notes.',
  "placeholder" = 'Accountant | Jane Smith | Smith CPA | jane@example.com | 555-123-4567 | Handles tax filings
Lawyer | John Lee | Lee Law | john@example.com | 555-222-3333 | Lease counsel',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "agentId" = 'professional_advisors'
  AND "fieldKey" = 'professionalAdvisorsList';

-- Software & Vendors: clarify purpose vs Material Contracts upload + auto-populate note.
UPDATE "AgentFormQuestion"
SET
  "description" = E'List every software tool, subscription, and vendor the business uses — including ones without a formal contract. Vendors from your uploaded Material & Vendor Contracts are auto-populated here; add any missing ones below.\n\nTwo options:\n1. Fill in the form below\n2. Upload an Excel file (downloadable template provided)',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "agentId" = 'vendor_directory'
  AND "fieldKey" = 'vendorDirectoryList';
