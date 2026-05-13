export interface PriceChangeEvent {
  date: string
  serviceVertical: string  // Boarding, Daycare, Grooming, Training, etc.
  previousPrice: string
  newPrice: string
  dollarChange: number | null
  percentChange: number | null
  notes: string
}

export interface VerticalPricingSummary {
  vertical: string
  currentPrice: string
  priceChanges24Mo: number
  avgChangePercent: number | null
  totalChangePercent: number | null
  lastChangeDate: string
  trend: 'increasing' | 'stable' | 'decreasing' | 'unknown'
  revenueShare: string  // from WS2-3 e.g. "42% of TTM revenue"
  recommendation: string
}

export interface PricingVerticalReport {
  generatedAt: string
  businessName: string
  priceChanges: PriceChangeEvent[]
  verticalSummaries: VerticalPricingSummary[]
  executiveSummary: string
  overallTrend: string
  recommendations: string[]
  flags: Array<{
    id: string
    severity: 'critical' | 'warning' | 'positive' | 'informational'
    title: string
    description: string
  }>
}
