import type {
  PriceChangeEvent,
  PricingVerticalReport,
  ServicePricingRow,
  VerticalPricingSummary,
} from './types'
import { parseMoneyValue } from './pricing-trend-chart'

function norm(s: string | undefined | null): string {
  return String(s ?? '').trim().toLowerCase()
}

/** Match timeline row to a vertical label (model wording varies). */
function changeBelongsToVertical(
  change: PriceChangeEvent,
  vertical: string,
  grid: ServicePricingRow[],
): boolean {
  const v = norm(vertical)
  const sv = norm(change.serviceVertical)
  if (!v) return false
  if (!sv) return false
  if (sv === v) return true
  if (sv.includes(v) || v.includes(sv)) return true
  for (const w of v.split(/\s+/)) {
    if (w.length >= 3 && sv.includes(w)) return true
  }
  for (const row of grid) {
    if (norm(row.vertical) !== v) continue
    const sn = norm(row.serviceName)
    if (!sn) continue
    if (sv === sn || sn.includes(sv) || sv.includes(sn)) return true
  }
  return false
}

function rowsForVertical(vertical: string, grid: ServicePricingRow[]): ServicePricingRow[] {
  const v = norm(vertical)
  const exact = grid.filter((r) => norm(r.vertical) === v)
  if (exact.length) return exact
  return grid.filter((r) => {
    const rv = norm(r.vertical)
    return rv.includes(v) || v.includes(rv)
  })
}

function detectSymbolFromCells(cells: string[]): string {
  for (const c of cells) {
    if (c.includes('£')) return '£'
    if (c.includes('$')) return '$'
    if (c.includes('€')) return '€'
  }
  return ''
}

function detectSymbolFromGrid(grid: ServicePricingRow[]): string {
  for (const row of grid) {
    for (const v of Object.values(row.prices ?? {})) {
      const s = String(v)
      if (s.includes('£')) return '£'
      if (s.includes('$')) return '$'
      if (s.includes('€')) return '€'
    }
  }
  return ''
}

function formatMoneyBand(min: number, max: number, symbol: string): string {
  const a = Math.round(min)
  const b = Math.round(max)
  if (a === b) return `${symbol}${a.toLocaleString('en-US')}`
  return `${symbol}${a.toLocaleString('en-US')}–${b.toLocaleString('en-US')}`
}

function isWeakCurrentPrice(s: string | undefined | null): boolean {
  if (s == null) return true
  const t = String(s).trim()
  if (!t || t === '—' || t === '-' || t === 'N/A' || t === 'n/a') return true
  return !/\d/.test(t)
}

function isWeakAvg(p: number | null | undefined): boolean {
  return p == null || !Number.isFinite(p)
}

function isWeakTotal(p: number | null | undefined): boolean {
  return p == null || !Number.isFinite(p)
}

function isUnknownTrend(t: VerticalPricingSummary['trend']): boolean {
  return t === 'unknown' || t == null
}

function trendFromAvg(avg: number | null): VerticalPricingSummary['trend'] {
  if (avg == null || !Number.isFinite(avg)) return 'unknown'
  if (avg > 0.75) return 'increasing'
  if (avg < -0.75) return 'decreasing'
  return 'stable'
}

function parseDateMs(d: string): number {
  const t = Date.parse(d)
  return Number.isFinite(t) ? t : 0
}

function gridRowPercentChanges(rows: ServicePricingRow[], periods: string[]): number[] {
  if (periods.length < 2) return []
  const first = periods[0]!
  const last = periods[periods.length - 1]!
  const out: number[] = []
  for (const row of rows) {
    const a = parseMoneyValue(row.prices?.[first] ?? '')
    const b = parseMoneyValue(row.prices?.[last] ?? '')
    if (a !== null && b !== null && a > 0) {
      out.push(((b - a) / a) * 100)
    }
  }
  return out
}

function enrichOneVertical(
  vs: VerticalPricingSummary,
  grid: ServicePricingRow[],
  changes: PriceChangeEvent[],
  periods: string[],
): VerticalPricingSummary {
  const rows = rowsForVertical(vs.vertical, grid)
  const vertChanges = changes.filter((c) => changeBelongsToVertical(c, vs.vertical, grid))
  const timelinePcts = vertChanges
    .map((c) => c.percentChange)
    .filter((x): x is number => typeof x === 'number' && Number.isFinite(x))

  const rowPcts = gridRowPercentChanges(rows, periods)

  let derivedAvg: number | null = null
  if (rowPcts.length) {
    derivedAvg = rowPcts.reduce((s, x) => s + x, 0) / rowPcts.length
  } else if (timelinePcts.length) {
    derivedAvg = timelinePcts.reduce((s, x) => s + x, 0) / timelinePcts.length
  }

  let derivedTotal: number | null = null
  if (rowPcts.length) {
    derivedTotal = rowPcts.reduce((s, x) => s + x, 0) / rowPcts.length
  } else if (timelinePcts.length) {
    derivedTotal = derivedAvg
  }

  const derivedChangeCount =
    vertChanges.length > 0
      ? vertChanges.length
      : rowPcts.filter((p) => Math.abs(p) > 0.25).length

  let derivedLast = '—'
  if (vertChanges.length) {
    const sorted = [...vertChanges].sort((a, b) => parseDateMs(b.date) - parseDateMs(a.date))
    derivedLast = sorted[0]?.date?.trim() || '—'
  }

  let derivedCurrent = ''
  if (rows.length && periods.length) {
    const lastPeriod = periods[periods.length - 1]!
    const cells = rows.map((r) => String(r.prices?.[lastPeriod] ?? ''))
    const nums = cells.map(parseMoneyValue).filter((x): x is number => x !== null)
    if (nums.length) {
      const sym = detectSymbolFromCells(cells) || detectSymbolFromGrid(grid)
      derivedCurrent = formatMoneyBand(Math.min(...nums), Math.max(...nums), sym)
    }
  }

  const derivedTrend = trendFromAvg(derivedAvg)

  return {
    ...vs,
    currentPrice: isWeakCurrentPrice(vs.currentPrice) && derivedCurrent ? derivedCurrent : vs.currentPrice,
    priceChanges24Mo:
      vs.priceChanges24Mo === 0 && derivedChangeCount > 0 ? derivedChangeCount : vs.priceChanges24Mo,
    avgChangePercent: isWeakAvg(vs.avgChangePercent) && derivedAvg != null ? derivedAvg : vs.avgChangePercent,
    totalChangePercent:
      isWeakTotal(vs.totalChangePercent) && derivedTotal != null ? derivedTotal : vs.totalChangePercent,
    lastChangeDate:
      (!vs.lastChangeDate?.trim() || vs.lastChangeDate === '—') && derivedLast !== '—'
        ? derivedLast
        : vs.lastChangeDate,
    trend: isUnknownTrend(vs.trend) && derivedTrend !== 'unknown' ? derivedTrend : vs.trend,
  }
}

/**
 * Fills vertical summary cards from the authoritative pricing grid + timeline when the model
 * left metrics blank (N/A, —, unknown trend) but structured data exists.
 */
export function enrichVerticalSummariesInReport(report: PricingVerticalReport): PricingVerticalReport {
  const grid = report.pricingGrid ?? []
  const changes = report.priceChanges ?? []
  const periods = report.pricingPeriods?.length ? report.pricingPeriods : ['Current']

  let summaries = [...(report.verticalSummaries ?? [])]

  if (!summaries.length && grid.length) {
    const seen = new Set<string>()
    const verticals: string[] = []
    for (const row of grid) {
      const v = String(row.vertical ?? '').trim()
      if (!v) continue
      const key = v.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      verticals.push(v)
    }
    summaries = verticals.map((vertical) => ({
      vertical,
      currentPrice: '—',
      priceChanges24Mo: 0,
      avgChangePercent: null,
      totalChangePercent: null,
      lastChangeDate: '—',
      trend: 'unknown',
      revenueShare: '',
      recommendation: '',
    }))
  }

  const verticalSummaries = summaries.map((vs) => enrichOneVertical(vs, grid, changes, periods))
  return { ...report, verticalSummaries }
}
