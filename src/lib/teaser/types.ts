export interface TeaserInputData {
  // Transaction Snapshot
  dealType: string
  location: string
  revenueRange: string
  serviceModel: string
  facilityCapacity: string
  processStage: string

  // Business Overview (section 01 uses businessOverview; section 02 uses headline + lead + bullet fields)
  businessOverview: string
  /** Section 02 main title under "Business Overview" (PDF). */
  overviewHeadline: string
  /** Section 02 lead paragraph below the headline (PDF). */
  section02LeadSummary: string
  facilityProfile: string
  ownershipManagement: string
  clientProfile: string
  staffOperations: string
  realEstate: string
  technology: string
  permitsZoning: string

  // Financial Highlights
  annualRevenue: string
  revenueGrowth: string
  normalizedEbitda: string
  ebitdaMargin: string
  revenueMix: string
  buyerCapex: string

  // Headline KPIs
  ttmRevenue: string
  normalizedEbitdaMargin: string
  totalCapacity: string

  // Investment Highlights (5 items)
  investmentHighlights: Array<{
    title: string
    description: string
  }>

  // Contact
  contactName: string
  contactTitle: string
  contactEmail: string

  // Branding
  businessDisplayName: string
  teaserSubtitle: string
  regionLabel: string
  /** Printed on the teaser cover when set (Cantara deal reference #). */
  dealReference: string
  ndaLink?: string
}

export interface TeaserGeneratorState {
  status: 'idle' | 'auto-filling' | 'ready' | 'generating' | 'complete' | 'error'
  inputData: TeaserInputData
  generatedHtml: string | null
  error: string | null
}

export const DEFAULT_TEASER_INPUT: TeaserInputData = {
  dealType: 'Asset or Equity Sale',
  location: '',
  revenueRange: '',
  serviceModel: '',
  facilityCapacity: '',
  processStage: 'LOI Solicitation',
  businessOverview: '',
  overviewHeadline: 'A Purpose-Built Premium Pet Resort',
  section02LeadSummary: '',
  facilityProfile: '',
  ownershipManagement: '',
  clientProfile: '',
  staffOperations: '',
  realEstate: '',
  technology: '',
  permitsZoning: '',
  annualRevenue: '',
  revenueGrowth: '',
  normalizedEbitda: '',
  ebitdaMargin: '',
  revenueMix: '',
  buyerCapex: 'Low',
  ttmRevenue: '',
  normalizedEbitdaMargin: '',
  totalCapacity: '',
  investmentHighlights: [
    { title: '', description: '' },
    { title: '', description: '' },
    { title: '', description: '' },
    { title: '', description: '' },
    { title: '', description: '' },
  ],
  contactName: '',
  contactTitle: '',
  contactEmail: '',
  businessDisplayName: '',
  teaserSubtitle: 'Acquisition Opportunity',
  regionLabel: '',
  dealReference: '',
  ndaLink: '',
}
