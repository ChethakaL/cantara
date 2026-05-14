export interface CompetitorPricingInput {
  name: string
  websiteUrl: string
}

export interface ServicePricingComparison {
  serviceCategory: string
  serviceDetail?: string
  sellerServiceBasis?: string
  competitorServiceBasis?: string
  normalizedUnit?: string
  sellerNormalizedPrice?: string
  sellerPrice: string      // e.g. "$45/night", "$35/day"
  sellerPriceNumeric: number | null
  competitorAvgPrice: string
  competitorAvgNumeric: number | null
  competitorRange: string  // e.g. "$38-$55/night"
  competitorPrices: Array<{ name: string; price: string; serviceBasis?: string; normalizedPrice?: string; sourceUrl?: string }>
  variance: string         // e.g. "-12% below average across competitors"
  variancePercent: number | null
  status: 'underpriced' | 'at-market' | 'premium' | 'unknown'
  upliftOpportunity: string  // e.g. "$5/night increase = $18,250/yr additional revenue"
  notes: string
}

export interface CompetitorServicePricingDetail {
  competitorName: string
  websiteUrl: string
  serviceName: string
  serviceCategory: string
  listedPrice: string
  serviceBasis: string
  durationHours: number | null
  normalizedHourlyPrice: number | null
  normalizedPriceLabel: string
  comparableToSellerService: string
  sourceUrl?: string
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
  sellerWebsiteUrl?: string | null
  competitors: CompetitorPricingInput[]
  competitorsAnalyzed: number
  competitorServiceDetails: CompetitorServicePricingDetail[]
  serviceComparisons: ServicePricingComparison[]
  flags: PricingFlag[]
  executiveSummary: string
  revenueUpliftSummary: string
  totalEstimatedUplift: string
  recommendations: string[]
}
