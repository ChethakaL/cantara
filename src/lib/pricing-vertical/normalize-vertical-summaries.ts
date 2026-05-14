import type { VerticalPricingSummary } from './types'

const TRENDS = new Set(['increasing', 'stable', 'decreasing', 'unknown'])

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(/%/g, '').trim())
    if (Number.isFinite(n)) return n
  }
  return null
}

function asInt(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v)
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return parseInt(v.trim(), 10)
  return fallback
}

function asString(v: unknown, fallback: string): string {
  if (typeof v === 'string') return v
  if (v != null && typeof v !== 'object') return String(v)
  return fallback
}

/** Coerce a loose model object into VerticalPricingSummary; merge with prior row when names match. */
export function normalizeVerticalSummary(
  raw: Record<string, unknown>,
  fallback?: VerticalPricingSummary,
): VerticalPricingSummary {
  const trendRaw = typeof raw.trend === 'string' ? raw.trend : ''
  const trend = TRENDS.has(trendRaw) ? (trendRaw as VerticalPricingSummary['trend']) : (fallback?.trend ?? 'unknown')

  return {
    vertical: asString(raw.vertical, fallback?.vertical ?? 'Unknown'),
    currentPrice: asString(raw.currentPrice, fallback?.currentPrice ?? '—'),
    priceChanges24Mo: asInt(raw.priceChanges24Mo, fallback?.priceChanges24Mo ?? 0),
    avgChangePercent: asFiniteNumber(raw.avgChangePercent) ?? fallback?.avgChangePercent ?? null,
    totalChangePercent: asFiniteNumber(raw.totalChangePercent) ?? fallback?.totalChangePercent ?? null,
    lastChangeDate: asString(raw.lastChangeDate, fallback?.lastChangeDate ?? '—'),
    trend,
    revenueShare: '',
    recommendation: asString(raw.recommendation, fallback?.recommendation ?? ''),
  }
}

/**
 * After a re-run, the model returns partial vertical rows. Merge with the previous report by vertical name
 * (case-insensitive), then by index, so PDF / UI never see undefined fields.
 */
export function mergeVerticalSummariesForRerun(
  previous: VerticalPricingSummary[],
  incoming: unknown,
): VerticalPricingSummary[] {
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return previous.length ? previous.map((v) => ({ ...v, revenueShare: '' })) : []
  }

  const byName = new Map(
    previous.map((v) => [String(v.vertical ?? '').toLowerCase(), v]),
  )

  return incoming.map((item, index) => {
    const raw = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const name = asString(raw.vertical, '')
    const fallback =
      (name && byName.get(name.toLowerCase())) ?? previous[index] ?? previous[0]
    return normalizeVerticalSummary(raw, fallback)
  })
}
