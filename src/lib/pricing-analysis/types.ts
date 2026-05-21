export interface CompetitorPricingInput {
  name: string
  websiteUrl: string
  manualPricingText?: string
}

export interface PriceMatrixRow {
  service: string
  basis: string  // "Full Day", "Half Day (4hr)", "Per Night", "10-Day Package", etc.
  sellerPrice: string  // raw listed price e.g. "$35/day"
  sellerNormalized: string  // normalized daily rate e.g. "$35"
  sellerNormalizedNumeric: number | null
  competitors: Array<{
    name: string
    listedPrice: string  // raw e.g. "$25/half day"
    normalized: string   // e.g. "$50" (half day x2)
    normalizedNumeric: number | null
    normalizationNote: string  // e.g. "Half day x2"
  }>
}

export interface PricingSummaryRow {
  service: string
  sellerPrice: string
  sellerPriceNumeric: number | null
  competitorAvg: string
  competitorAvgNumeric: number | null
  variance: string  // e.g. "-11.4%"
  variancePercent: number | null
  status: 'underpriced' | 'at-market' | 'premium' | 'unknown'
  estAnnualUplift: string
}

export interface PricingFlag {
  id: string
  severity: 'critical' | 'warning' | 'positive' | 'informational'
  title: string
  description: string
}

export interface PricingAnalysisReport {
  generatedAt: string
  businessName: string
  radiusMiles: number
  sellerWebsiteUrl?: string | null
  competitors: Array<{ name: string; websiteUrl: string }>
  competitorsAnalyzed: number
  priceMatrix: PriceMatrixRow[]
  pricingSummary: PricingSummaryRow[]
  flags: PricingFlag[]
  executiveSummary: string
  totalEstimatedUplift: string
  recommendations: string[]
}
