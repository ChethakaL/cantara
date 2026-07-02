export interface CimIncomeRow {
  label: string
  fy1: string; fy1Pct: string
  fy2: string; fy2Pct: string
  fy3: string; fy3Pct: string
  ttm: string; ttmPct: string
  proj1: string; proj1Pct: string
  proj2: string; proj2Pct: string
}

export interface CimServiceLine {
  name: string
  ttmRevenue: string
  pctOfTotal: string
}

export interface CimNormalizationItem {
  item: string
  ttmAmount: string
  commentary: string
}

export interface CimValueCreation {
  initiative: string
  description: string
  timing: string
  revenueImpact: string
  dependencies: string
}

export interface CimCompetitor {
  name: string
  distance: string
  services: string
  capacity: string
  rating: string
  commentary: string
}

export interface CimInputData {
  // Cover
  businessName: string
  subtitle: string
  region: string
  serviceLines: string
  /** Printed on the CIM cover when set (Cantara deal reference #). */
  dealReference: string

  // 01 Executive Summary
  investmentOverview: string
  investmentThesis: string[]  // bullet points
  sellerOverview: string
  transactionOverview: string

  // 02 Business Overview
  businessDescription: string
  facilityProfile: string
  ownershipManagement: string
  clientProfile: string
  staffOperations: string
  realEstate: string
  technology: string
  permitsZoning: string

  // 03 Financial Performance
  financialHighlights: string[]
  incomeStatement: CimIncomeRow[]
  incomeFootnote: string
  serviceLineBreakdown: CimServiceLine[]
  monthlyTrending: string  // HTML table or chart description

  // 04 EBITDA Normalization
  normalizationNotes: string[]
  normalizationItems: CimNormalizationItem[]
  normalizationFootnote: string

  // 05 Value Creation
  valueCreationIntro: string
  valueCreationItems: CimValueCreation[]

  // 06 Operations & Management
  orgChartHtml: string
  gmProfile: { name: string; tenure: string; certifications: string; transition: string; responsibilities: string }
  staffingOverview: string[]
  technologyStack: string[]
  marketingOverview: string[]
  marketingOpportunities: string[]

  // 07 Real Estate
  facilityDetails: Array<{ label: string; value: string }>
  leaseDetails: Array<{ label: string; value: string }>

  // 08 Competitive Landscape
  competitiveIntro: string[]
  competitors: CimCompetitor[]
  pricingComparison: string  // HTML table

  // 09 Transaction Details
  transactionTerms: Array<{ label: string; value: string }>
  dataRoomContents: Array<{ category: string; items: string }>
  processSteps: Array<{ step: string; title: string; description: string }>

  // Contact
  contactName: string
  contactTitle: string
  contactEmail: string

  // New facility images
  facilityImages?: string[]
}

export const DEFAULT_CIM_INPUT: CimInputData = {
  businessName: '',
  subtitle: 'Acquisition Opportunity',
  region: '',
  serviceLines: 'Boarding \u00b7 Daycare \u00b7 Grooming \u00b7 Training \u00b7 Wellness',
  dealReference: '',
  investmentOverview: '',
  investmentThesis: ['', '', '', '', ''],
  sellerOverview: '',
  transactionOverview: 'Managed exclusively by Cantara Pet Business Advisors, this confidential sale process provides qualified buyers with full financial and lease documentation, with management meetings available upon receipt of a qualified LOI.',
  businessDescription: '',
  facilityProfile: '',
  ownershipManagement: '',
  clientProfile: '',
  staffOperations: '',
  realEstate: '',
  technology: '',
  permitsZoning: '',
  financialHighlights: ['', '', '', ''],
  incomeStatement: [],
  incomeFootnote: '* Management accounts basis. EBITDA normalized for owner-specific add-backs. Full financial package available in data room.',
  serviceLineBreakdown: [],
  monthlyTrending: '',
  normalizationNotes: ['', '', ''],
  normalizationItems: [],
  normalizationFootnote: 'Full normalization schedule with line-item backup including bank statements, payroll records, and owner tax returns is available in the data room.',
  valueCreationIntro: 'Five identified initiatives \u2014 near-term operational improvements and strategic growth levers:',
  valueCreationItems: [],
  orgChartHtml: '',
  gmProfile: { name: '', tenure: '', certifications: '', transition: '', responsibilities: '' },
  staffingOverview: [],
  technologyStack: [],
  marketingOverview: [],
  marketingOpportunities: [],
  facilityDetails: [],
  leaseDetails: [],
  competitiveIntro: [],
  competitors: [],
  pricingComparison: '',
  transactionTerms: [],
  dataRoomContents: [],
  processSteps: [
    { step: 'Step 1', title: 'Data Room Review', description: 'CIM, financials & full diligence materials' },
    { step: 'Step 2', title: 'Submit LOI', description: 'Management meeting & letter of intent' },
    { step: 'Step 3', title: 'Diligence & Close', description: 'Exclusivity, confirmatory diligence & close' },
  ],
  contactName: 'Craig Pollack',
  contactTitle: 'Chief Executive Officer \u00b7 Cantara Pet Advisors',
  contactEmail: 'craig@cantarapet.com',
  facilityImages: [],
}
