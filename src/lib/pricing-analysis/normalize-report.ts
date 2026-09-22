import type {
  PriceMatrixRow,
  PricingAnalysisReport,
  PricingFlag,
  PricingSummaryRow,
} from './types'
import { parsePriceForChart, unglueSuspiciousPrice } from './parse-price'

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : []
}

function sanitizeMoneyString(value: string): string {
  const t = String(value ?? '').trim()
  if (!t) return ''
  // If the whole string is a glued integer, replace with repaired dollar amount.
  const onlyInt = t.match(/^\$?\s*(\d{4,6})\s*$/)
  if (onlyInt) {
    const raw = Number(onlyInt[1])
    const fixed = unglueSuspiciousPrice(raw)
    if (fixed !== raw) return `$${Number.isInteger(fixed) ? fixed : fixed.toFixed(2)}`
  }
  return t
}

function sanitizeNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? unglueSuspiciousPrice(value) : value
  }
  if (typeof value === 'string') {
    return parsePriceForChart(value)
  }
  return null
}

function migrateLegacyReport(raw: Record<string, unknown>): PricingAnalysisReport {
  const comparisons = asArray<Record<string, unknown>>(raw.serviceComparisons)

  const priceMatrix: PriceMatrixRow[] = comparisons.map(row => ({
    service:
      [row.serviceCategory, row.serviceDetail].filter(Boolean).join(' - ') ||
      String(row.serviceCategory ?? 'Service'),
    basis: String(row.sellerServiceBasis ?? row.competitorServiceBasis ?? ''),
    sellerPrice: String(row.sellerPrice ?? ''),
    sellerNormalized: String(row.sellerNormalizedPrice ?? row.sellerPrice ?? ''),
    sellerNormalizedNumeric:
      typeof row.sellerPriceNumeric === 'number' ? row.sellerPriceNumeric : null,
    competitors: asArray<Record<string, unknown>>(row.competitorPrices).map(comp => ({
      name: String(comp.name ?? ''),
      listedPrice: String(comp.price ?? ''),
      normalized: String(comp.normalizedPrice ?? comp.price ?? ''),
      normalizedNumeric: null,
      normalizationNote: String(comp.serviceBasis ?? ''),
    })),
  }))

  const pricingSummary: PricingSummaryRow[] = comparisons.map(row => ({
    service:
      [row.serviceCategory, row.serviceDetail].filter(Boolean).join(' - ') ||
      String(row.serviceCategory ?? 'Service'),
    sellerPrice: String(row.sellerNormalizedPrice ?? row.sellerPrice ?? ''),
    sellerPriceNumeric:
      typeof row.sellerPriceNumeric === 'number' ? row.sellerPriceNumeric : null,
    competitorAvg: String(row.competitorAvgPrice ?? ''),
    competitorAvgNumeric:
      typeof row.competitorAvgNumeric === 'number' ? row.competitorAvgNumeric : null,
    variance: String(row.variance ?? ''),
    variancePercent: typeof row.variancePercent === 'number' ? row.variancePercent : null,
    status: (row.status as PricingSummaryRow['status']) ?? 'unknown',
    estAnnualUplift: String(row.upliftOpportunity ?? ''),
  }))

  return normalizeNewReport({
    ...raw,
    priceMatrix,
    pricingSummary,
    totalEstimatedUplift: raw.totalEstimatedUplift ?? raw.revenueUpliftSummary ?? '',
  })
}

function normalizeNewReport(raw: Record<string, unknown>): PricingAnalysisReport {
  const priceMatrix = asArray<Record<string, unknown>>(raw.priceMatrix).map(row => ({
    service: String(row.service ?? ''),
    basis: String(row.basis ?? ''),
    sellerPrice: sanitizeMoneyString(String(row.sellerPrice ?? '')),
    sellerNormalized: sanitizeMoneyString(String(row.sellerNormalized ?? '')),
    sellerNormalizedNumeric: sanitizeNumeric(row.sellerNormalizedNumeric ?? row.sellerNormalized ?? row.sellerPrice),
    competitors: asArray<Record<string, unknown>>(row.competitors).map(comp => ({
      name: String(comp.name ?? ''),
      listedPrice: sanitizeMoneyString(String(comp.listedPrice ?? '')),
      normalized: sanitizeMoneyString(String(comp.normalized ?? '')),
      normalizedNumeric: sanitizeNumeric(comp.normalizedNumeric ?? comp.normalized ?? comp.listedPrice),
      normalizationNote: String(comp.normalizationNote ?? ''),
    })),
  }))

  const pricingSummary = asArray<Record<string, unknown>>(raw.pricingSummary).map(row => ({
    service: String(row.service ?? ''),
    sellerPrice: sanitizeMoneyString(String(row.sellerPrice ?? '')),
    sellerPriceNumeric: sanitizeNumeric(row.sellerPriceNumeric ?? row.sellerPrice),
    competitorAvg: sanitizeMoneyString(String(row.competitorAvg ?? '')),
    competitorAvgNumeric: sanitizeNumeric(row.competitorAvgNumeric ?? row.competitorAvg),
    variance: String(row.variance ?? ''),
    variancePercent: typeof row.variancePercent === 'number' ? row.variancePercent : null,
    status: (row.status as PricingSummaryRow['status']) ?? 'unknown',
    estAnnualUplift: String(row.estAnnualUplift ?? ''),
  }))

  const flags: PricingFlag[] = asArray<Record<string, unknown>>(raw.flags).map((flag, index) => ({
    id: String(flag.id ?? `flag-${index}`),
    severity: (flag.severity as PricingFlag['severity']) ?? 'informational',
    title: String(flag.title ?? ''),
    description: String(flag.description ?? ''),
  }))

  return {
    generatedAt: String(raw.generatedAt ?? new Date().toISOString()),
    businessName: String(raw.businessName ?? ''),
    radiusMiles: typeof raw.radiusMiles === 'number' ? raw.radiusMiles : 0,
    sellerWebsiteUrl: raw.sellerWebsiteUrl != null ? String(raw.sellerWebsiteUrl) : null,
    competitors: asArray(raw.competitors) as PricingAnalysisReport['competitors'],
    hiddenCompetitorNames: asArray<string>(raw.hiddenCompetitorNames).map(String),
    matrixColumnHeaders: raw.matrixColumnHeaders && typeof raw.matrixColumnHeaders === 'object'
      ? raw.matrixColumnHeaders as PricingAnalysisReport['matrixColumnHeaders']
      : undefined,
    competitorsAnalyzed:
      typeof raw.competitorsAnalyzed === 'number' ? raw.competitorsAnalyzed : 0,
    priceMatrix,
    pricingSummary,
    flags,
    executiveSummary: String(raw.executiveSummary ?? ''),
    totalEstimatedUplift: String(raw.totalEstimatedUplift ?? ''),
    recommendations: asArray<string>(raw.recommendations).map(String),
  }
}

/** Normalize AI output or stored JSON (including pre-rebuild legacy reports). */
export function normalizePricingReport(raw: unknown): PricingAnalysisReport | null {
  if (!raw || typeof raw !== 'object') return null
  const report = raw as Record<string, unknown>

  if (!String(report.executiveSummary ?? '').trim()) return null

  if (Array.isArray(report.serviceComparisons) && report.serviceComparisons.length > 0) {
    return migrateLegacyReport(report)
  }

  return normalizeNewReport(report)
}

export function hasPricingTableData(report: PricingAnalysisReport): boolean {
  return report.priceMatrix.length > 0 || report.pricingSummary.length > 0
}

export function getCompetitorNamesFromReport(report: PricingAnalysisReport): string[] {
  const fromMatrix = report.priceMatrix.flatMap(row =>
    row.competitors.map(competitor => competitor.name).filter(Boolean),
  )
  const fromSaved = (report.competitors ?? []).map(c => c.name).filter(Boolean)
  return Array.from(new Set([...fromMatrix, ...fromSaved]))
}
