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
  /** Deprecated for output: kept for backward compatibility with saved JSON; leave empty. */
  revenueShare?: string
  recommendation: string
}

export interface ServicePricingRow {
  id: string
  serviceName: string
  vertical: string
  source: 'website' | 'document' | 'manual' | 'ai_inferred'
  sourceUrl?: string
  confidence: 'high' | 'medium' | 'low'
  prices: Record<string, string>
}

/** Advisor triage: omitted = needs review; kept = acknowledged; declined = dismissed (hidden from queue & PDF). */
export type PricingVerticalFlagResolution = 'kept' | 'declined'

export interface PricingVerticalFlag {
  id: string
  severity: 'critical' | 'warning' | 'positive' | 'informational'
  title: string
  description: string
  resolution?: PricingVerticalFlagResolution
}

export interface PricingVerticalReport {
  generatedAt: string
  businessName: string
  currentPricingSource?: {
    websiteUrl?: string | null
    confidence: 'high' | 'medium' | 'low'
    evidenceCount: number
    notes: string
  }
  pricingPeriods: string[]
  pricingGrid: ServicePricingRow[]
  priceChanges: PriceChangeEvent[]
  verticalSummaries: VerticalPricingSummary[]
  executiveSummary: string
  overallTrend: string
  recommendations: string[]
  flags: PricingVerticalFlag[]
}
