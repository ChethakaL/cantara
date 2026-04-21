import type { Workstream, BusinessType } from './store'

export interface DocumentDef {
  id: string
  name: string
  description: string
  type: 'required' | 'yes_no' | 'conditional'
  workstreams: Workstream[]  // which workstreams show this doc
  perBranch?: boolean        // duplicated per location if multi/parent
  parentOnly?: boolean       // shown once at parent level even for multi
  flagged?: boolean
  flagNote?: string
}

export interface CategoryDef {
  id: string
  title: string
  icon: string
  documents: DocumentDef[]
}

// Business Valuation - standalone, always first, all workstreams
export const VALUATION_DOCS: DocumentDef[] = [
  {
    id: 'monthly_pl_excel',
    name: 'Monthly P&L Excel',
    description: '36-month monthly P&L in Excel format with all GL codes visible.',
    type: 'required',
    workstreams: ['ws1', 'ws2', 'both', 'ma'],
  },
  {
    id: 'monthly_bs_excel',
    name: 'Monthly Balance Sheet Excel',
    description: '36-month monthly balance sheet in Excel format with all GL codes visible.',
    type: 'required',
    workstreams: ['ws1', 'ws2', 'both', 'ma'],
  },
  {
    id: 'accountant_statements',
    name: 'Accountant-Prepared Financial Statements',
    description: 'Three fiscal years of accountant-prepared financial statements in Excel or PDF format.',
    type: 'required',
    workstreams: ['ws1', 'ws2', 'both', 'ma'],
  },
  {
    id: 'addback_disclosure',
    name: 'File 5 — Seller Add-Back Disclosure',
    description: 'Consolidated add-back disclosure: owner/officer compensation, personal expenses, non-recurring expenses, and tenant improvements over 36 months with GL cross-references.',
    type: 'required',
    workstreams: ['ws2', 'both', 'ma'],
  },
  {
    id: 'shareholder_remuneration_36m',
    name: 'Shareholder List + Remuneration (36 months)',
    description: 'Owner/shareholder compensation detail for the last 36 months with GL cross-references. (Legacy — use File 5 if available.)',
    type: 'conditional',
    workstreams: ['ws2', 'both', 'ma'],
  },
  {
    id: 'personal_expenses_36m',
    name: 'Personal Expenses Charged to Business (36 months)',
    description: 'List of personal expenses run through the business over the last 36 months with GL cross-references. (Legacy — use File 5 if available.)',
    type: 'conditional',
    workstreams: ['ws2', 'both', 'ma'],
  },
  {
    id: 'non_recurring_expenses_36m',
    name: 'Material One-Off Non-Recurring Expenses (36 months)',
    description: 'List of non-recurring expenses above $5,000 over the last 36 months with GL cross-references. (Legacy — use File 5 if available.)',
    type: 'conditional',
    workstreams: ['ws2', 'both', 'ma'],
  },
  {
    id: 'tenant_improvements_36m',
    name: 'Material Tenant Improvements (36 months)',
    description: 'List of tenant improvements above $5,000 over the last 36 months with GL cross-references. (Legacy — use File 5 if available.)',
    type: 'conditional',
    workstreams: ['ws2', 'both', 'ma'],
  },
]

export const DOCUMENT_CATEGORIES: CategoryDef[] = [
  {
    id: 'legal_entity',
    title: 'Legal & Entity',
    icon: 'Scale',
    documents: [
      { id: 'articles_org', name: 'Articles of Organization / Incorporation', description: 'Company articles of organization or incorporation.', type: 'required', workstreams: ['ws1', 'ws2', 'both', 'ma'], parentOnly: true },
      { id: 'shareholder_agreement', name: "Shareholder's Agreement", description: 'Upload if applicable. For multi-location businesses this lives at the parent entity level.', type: 'yes_no', workstreams: ['ws1', 'ws2', 'both', 'ma'], parentOnly: true },
      { id: 'business_licenses', name: 'Business Licenses (City + County)', description: 'All current business licenses.', type: 'required', workstreams: ['ws1', 'ws2', 'both', 'ma'], perBranch: true },
      { id: 'zoning_approval', name: 'Zoning Approval / CUP / Use Permit', description: 'Zoning approval documentation.', type: 'required', workstreams: ['ws1', 'ws2', 'both', 'ma'], perBranch: true, flagged: true, flagNote: 'Priority review item — zoning varies by municipality.' },
      { id: 'certificate_occupancy', name: 'Certificate of Occupancy', description: 'Current certificate of occupancy.', type: 'required', workstreams: ['ws1', 'ws2', 'both', 'ma'], perBranch: true },
      { id: 'building_permits', name: 'Building Permits (if renovation done)', description: 'Upload if any renovations have been done.', type: 'yes_no', workstreams: ['ws1', 'ws2', 'both', 'ma'], perBranch: true },
      { id: 'health_safety', name: 'Health & Safety Inspection Reports', description: 'Any health and safety inspection reports.', type: 'yes_no', workstreams: ['ws1', 'ws2', 'both', 'ma'], perBranch: true },
      { id: 'violations', name: 'Violations / Citations (last 36 months)', description: 'Disclose violations. If yes, upload supporting documents.', type: 'yes_no', workstreams: ['ws1', 'ws2', 'both', 'ma'], perBranch: true },
      { id: 'sales_tax_permit', name: 'Sales Tax / Seller\'s Permit', description: 'Upload if retail services apply.', type: 'conditional', workstreams: ['ws1', 'ws2', 'both', 'ma'], perBranch: true },
      { id: 'leases', name: 'Lease(s) + All Addendums', description: 'All leases with every addendum and amendment.', type: 'required', workstreams: ['ws1', 'ws2', 'both', 'ma'], perBranch: true },
    ],
  },
  {
    id: 'financial',
    title: 'Financial & Tax',
    icon: 'DollarSign',
    documents: [
      { id: 'tax_returns_3yr', name: 'Business Tax Returns (3 years)', description: 'Last 3 years of filed business tax returns.', type: 'required', workstreams: ['ws1', 'ws2', 'both', 'ma'], parentOnly: false },
      { id: 'balance_sheet', name: 'Balance Sheet (current + 2 prior years)', description: 'Current and prior two years balance sheets.', type: 'required', workstreams: ['ws2', 'both', 'ma'] },
      { id: 'accounts_payable', name: 'Accounts Payable Aging', description: 'Current A/P aging report.', type: 'yes_no', workstreams: ['ws2', 'both', 'ma'] },
      { id: 'bank_statements', name: 'Bank Statements (12 months)', description: 'Last 12 months of business bank statements.', type: 'required', workstreams: ['ws1', 'ws2', 'both', 'ma'] },
      { id: 'loan_docs', name: 'Loan Documents / Line of Credit', description: 'Any outstanding loans or lines of credit.', type: 'yes_no', workstreams: ['ws1', 'ws2', 'both', 'ma'] },
      { id: 'insurance_claims_12m', name: 'Insurance Claims (last 12 months)', description: 'In the last 12 months have you claimed any insurance claims? If yes, upload the insurance claim document.', type: 'yes_no', workstreams: ['ws1', 'ws2', 'both', 'ma'] },
    ],
  },
  {
    id: 'operations',
    title: 'Operations',
    icon: 'Settings',
    documents: [
      { id: 'employee_list', name: 'Employee List (titles, hours, compensation)', description: 'Full employee list with roles, hours, and compensation. Do not include SSNs — upload via the secure portal only.', type: 'required', workstreams: ['ws1', 'ws2', 'both', 'ma'], perBranch: true },
      { id: 'org_chart', name: 'Organizational Chart', description: 'Current org chart.', type: 'yes_no', workstreams: ['ws2', 'both', 'ma'] },
      { id: 'key_employee_contracts', name: 'Key Employee / Manager Contracts', description: 'Employment agreements for key staff.', type: 'yes_no', workstreams: ['ws1', 'ws2', 'both', 'ma'] },
      { id: 'sop_manual', name: 'Operations / SOP Manual', description: 'Standard operating procedures documentation.', type: 'yes_no', workstreams: ['ws2', 'both', 'ma'] },
      { id: 'software_subscriptions', name: 'Software Subscriptions / PMS List', description: 'List of all software tools and subscriptions used.', type: 'required', workstreams: ['ws1', 'ws2', 'both', 'ma'] },
      { id: 'vendor_contracts', name: 'Vendor / Supplier Contracts', description: 'Key vendor and supplier agreements.', type: 'yes_no', workstreams: ['ws1', 'ws2', 'both', 'ma'] },
      { id: 'insurance_policies', name: 'Insurance Policies (all active)', description: 'All active business insurance policies.', type: 'required', workstreams: ['ws1', 'ws2', 'both', 'ma'] },
    ],
  },
  {
    id: 'customers',
    title: 'Customer & Revenue',
    icon: 'Users',
    documents: [
      { id: 'revenue_breakdown', name: 'Revenue Breakdown by Service Line', description: 'Revenue split between boarding, daycare, grooming, training, etc.', type: 'required', workstreams: ['ws2', 'both', 'ma'] },
      { id: 'customer_count', name: 'Active Customer Count (last 12 months)', description: 'Count of unique active customers.', type: 'required', workstreams: ['ws2', 'both', 'ma'] },
      { id: 'pricing_schedule', name: 'Current Pricing Schedule', description: 'Current rates for all services.', type: 'required', workstreams: ['ws2', 'both', 'ma'] },
      { id: 'online_reviews', name: 'Online Review Summary (Google / Yelp)', description: 'Screenshots or export of review profiles.', type: 'yes_no', workstreams: ['ws1', 'ws2', 'both', 'ma'] },
    ],
  },
  {
    id: 'ma_specific',
    title: 'M&A Specific',
    icon: 'Briefcase',
    documents: [
      { id: 'ownership_structure', name: 'Ownership / Cap Table', description: 'Full ownership structure and capitalization table.', type: 'required', workstreams: ['ma'], parentOnly: true },
      { id: 'prior_offers', name: 'Prior LOIs / Offers Received', description: 'Any prior offers or letters of intent received.', type: 'yes_no', workstreams: ['ma'] },
      { id: 'environmental_reports', name: 'Environmental Reports (if any)', description: 'Phase I or Phase II ESA reports if conducted.', type: 'yes_no', workstreams: ['ma'], perBranch: true },
      { id: 'intellectual_property', name: 'Trademarks / IP Registrations', description: 'Any registered trademarks, IP, or domain ownership.', type: 'yes_no', workstreams: ['ma'] },
      { id: 'pending_litigation', name: 'Pending Litigation / Legal Disputes', description: 'Disclosure of any active or threatened litigation.', type: 'yes_no', workstreams: ['ws1', 'ws2', 'both', 'ma'] },
    ],
  },
]

export function getDocsForWorkstream(ws: Workstream, businessType: BusinessType): CategoryDef[] {
  if (!ws) return []
  return DOCUMENT_CATEGORIES.map(cat => ({
    ...cat,
    documents: cat.documents.filter(doc => doc.workstreams.includes(ws)),
  })).filter(cat => cat.documents.length > 0)
}
