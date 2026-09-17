import type { PriceChangeEvent, PricingVerticalReport, ServicePricingRow, VerticalPricingSummary } from './types'
import { normalizeVerticalSummary } from './normalize-vertical-summaries'

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return fallback
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}

/** Accept alternate LLM keys so the UI never crashes on .toFixed / missing fields. */
export function normalizePriceChangeEvent(raw: unknown, _index = 0): PriceChangeEvent {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    date: asString(row.date ?? row.effectiveDate ?? row.when, ''),
    serviceVertical: asString(
      row.serviceVertical ?? row.vertical ?? row.serviceName ?? row.service,
      'Unknown',
    ),
    previousPrice: asString(row.previousPrice ?? row.priorPrice ?? row.fromPrice, ''),
    newPrice: asString(row.newPrice ?? row.toPrice, ''),
    dollarChange: asNullableNumber(row.dollarChange ?? row.dollar_change ?? row.amountChange),
    percentChange: asNullableNumber(
      row.percentChange ?? row.changePercent ?? row.percent_change ?? row.pctChange,
    ),
    notes: asString(row.notes ?? row.description ?? row.note, ''),
  }
}

function normalizePricingGridRow(raw: unknown, index: number): ServicePricingRow {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const prices =
    row.prices && typeof row.prices === 'object' && !Array.isArray(row.prices)
      ? Object.fromEntries(
          Object.entries(row.prices as Record<string, unknown>).map(([k, v]) => [k, asString(v, '')]),
        )
      : {}
  return {
    id: asString(row.id, `row-${index}`),
    serviceName: asString(row.serviceName ?? row.service, ''),
    vertical: asString(row.vertical, 'Other'),
    source: (['website', 'document', 'manual', 'ai_inferred'].includes(String(row.source))
      ? row.source
      : 'document') as ServicePricingRow['source'],
    sourceUrl: typeof row.sourceUrl === 'string' ? row.sourceUrl : undefined,
    confidence: (['high', 'medium', 'low'].includes(String(row.confidence))
      ? row.confidence
      : 'medium') as ServicePricingRow['confidence'],
    prices,
  }
}

/**
 * Normalize a pricing-vertical report (fresh analyze, update-from-edits, or loaded JSON)
 * so required arrays/objects exist and priceChanges use the UI schema.
 */
export function normalizePricingVerticalReport(
  input: PricingVerticalReport | Record<string, unknown> | null | undefined,
): PricingVerticalReport {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const priceChangesRaw = Array.isArray(raw.priceChanges) ? raw.priceChanges : []
  const pricingGridRaw = Array.isArray(raw.pricingGrid) ? raw.pricingGrid : []
  const periods = Array.isArray(raw.pricingPeriods)
    ? (raw.pricingPeriods as unknown[]).map((p) => asString(p)).filter(Boolean)
    : []

  return {
    ...(raw as unknown as PricingVerticalReport),
    generatedAt: asString(raw.generatedAt, new Date().toISOString()),
    businessName: asString(raw.businessName, ''),
    pricingPeriods: periods,
    pricingGrid: pricingGridRaw.map(normalizePricingGridRow),
    priceChanges: priceChangesRaw.map(normalizePriceChangeEvent),
    verticalSummaries: Array.isArray(raw.verticalSummaries)
      ? (raw.verticalSummaries as unknown[]).map((vs) => {
          const row = vs && typeof vs === 'object' ? (vs as Record<string, unknown>) : {}
          return normalizeVerticalSummary(row, vs as VerticalPricingSummary | undefined)
        })
      : [],
    executiveSummary: asString(raw.executiveSummary, ''),
    overallTrend: asString(raw.overallTrend, ''),
    recommendations: Array.isArray(raw.recommendations)
      ? (raw.recommendations as unknown[]).map((r) => asString(r)).filter(Boolean)
      : [],
    flags: Array.isArray(raw.flags) ? (raw.flags as PricingVerticalReport['flags']) : [],
  }
}
