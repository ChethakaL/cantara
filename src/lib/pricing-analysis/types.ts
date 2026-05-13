export interface ServicePricingComparison {
  serviceCategory: string  // Boarding, Daycare, Grooming, Training, Cat Boarding, Other
  sellerPrice: string      // e.g. "$45/night", "$35/day"
  sellerPriceNumeric: number | null
  competitorAvgPrice: string
  competitorAvgNumeric: number | null
  competitorRange: string  // e.g. "$38-$55/night"
  competitorPrices: Array<{ name: string; price: string }>
  variance: string         // e.g. "-12% below market"
  variancePercent: number | null
  status: 'underpriced' | 'at-market' | 'premium' | 'unknown'
  upliftOpportunity: string  // e.g. "$5/night increase = $18,250/yr additional revenue"
  notes: string
}

export interface PricingFlag {
  id: string
  severity: 'critical' | 'warning' | 'positive' | 'informational'
  category: string
  title: string
  description: string
}

export interface PricingAnalysisReport {
  generatedAt: string
  businessName: string
  radiusMiles: number
  competitorsAnalyzed: number
  serviceComparisons: ServicePricingComparison[]
  flags: PricingFlag[]
  executiveSummary: string
  revenueUpliftSummary: string
  totalEstimatedUplift: string
  recommendations: string[]
}
