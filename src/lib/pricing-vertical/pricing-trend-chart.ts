/**
 * Shared pricing grid → multi-series line chart (used in PricingByVerticalTab and PDF export).
 */

import type { ServicePricingRow } from './types'

const CHART_X_RANGE = 760
const CHART_Y_TOP = 50
const CHART_Y_BOTTOM = 220

/** Line colors (same order as in-app chart). */
export const PRICING_CHART_LINE_COLORS = [
  '#d97706',
  '#2563eb',
  '#059669',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#ca8a04',
  '#4f46e5',
  '#16a34a',
  '#be123c',
  '#0f766e',
  '#9333ea',
]

export function parseMoneyValue(value: string): number | null {
  const match = value.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : null
}

export type PricingChartSeriesItem = { row: ServicePricingRow; values: (number | null)[] }

export type PricingChartBuildResult = {
  series: PricingChartSeriesItem[]
  min: number
  max: number
}

export function buildPricingChartSeries(
  rows: ServicePricingRow[],
  periods: string[],
  maxSeries = 12,
): PricingChartBuildResult {
  const eligible = rows
    .map((row) => ({
      row,
      values: periods.map((period) => parseMoneyValue(row.prices?.[period] ?? '')),
    }))
    .filter((item) => item.values.filter((value) => value !== null).length >= 2)
    .slice(0, maxSeries)

  const numericValues = eligible.flatMap((item) => item.values).filter((value): value is number => value !== null)
  if (!numericValues.length) return { series: [], min: 0, max: 0 }
  return {
    series: eligible,
    min: Math.min(...numericValues),
    max: Math.max(...numericValues),
  }
}

export function buildPolylinePointsString(
  values: Array<number | null>,
  min: number,
  max: number,
  xRange: number = CHART_X_RANGE,
): string {
  const span = max - min || 1
  const vSpan = CHART_Y_BOTTOM - CHART_Y_TOP
  return values
    .map((value, index) => {
      if (value === null) return null
      const x = values.length === 1 ? 0 : (index / (values.length - 1)) * xRange
      const y = CHART_Y_BOTTOM - ((value - min) / span) * vSpan
      return `${x},${y}`
    })
    .filter(Boolean)
    .join(' ')
}

function detectCurrencySymbol(grid: ServicePricingRow[]): string {
  for (const row of grid) {
    for (const v of Object.values(row.prices ?? {})) {
      if (typeof v === 'string' && v.includes('£')) return '£'
      if (typeof v === 'string' && v.includes('$')) return '$'
    }
  }
  return '$'
}

/** Min/max labels next to the chart (matches PDF export). */
export function formatPricingChartAxisLabel(grid: ServicePricingRow[], n: number): string {
  const sym = detectCurrencySymbol(grid)
  return `${sym}${Math.round(n).toLocaleString('en-US')}`
}

function escAttr(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
}

function escText(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * HTML fragment for the print/PDF report: same visual idea as the in-app Service Price Trend chart.
 */
export function buildPricingTrendChartSectionHtml(report: {
  pricingGrid?: ServicePricingRow[]
  pricingPeriods?: string[]
}): string {
  const periods = report.pricingPeriods?.length ? report.pricingPeriods : ['Current']
  const chart = buildPricingChartSeries(report.pricingGrid ?? [], periods)
  if (!chart.series.length) {
    return '<p style="font-size:13px;color:#64748b;margin:0;">No chartable trend yet: at least one service needs numeric prices in two or more periods.</p>'
  }

  const fmtAxis = (n: number) => formatPricingChartAxisLabel(report.pricingGrid ?? [], n)

  const gridLines = [0, 1, 2, 3]
    .map(
      (i) =>
        `<line x1="60" x2="820" y1="${50 + i * 56}" y2="${50 + i * 56}" stroke="#e2e8f0" stroke-width="1"/>`,
    )
    .join('')

  const periodLabels = periods
    .map((period, i) => {
      const x = 60 + (periods.length === 1 ? 0 : (i / (periods.length - 1)) * CHART_X_RANGE)
      return `<text x="${x}" y="282" text-anchor="middle" font-size="11" fill="#64748b">${escText(period)}</text>`
    })
    .join('')

  const polylines = chart.series
    .map((item, i) => {
      const pts = buildPolylinePointsString(item.values, chart.min, chart.max)
      const stroke = PRICING_CHART_LINE_COLORS[i % PRICING_CHART_LINE_COLORS.length]
      return `<g transform="translate(60 0)"><polyline points="${escAttr(pts)}" fill="none" stroke="${stroke}" stroke-width="2"/></g>`
    })
    .join('')

  const legend = chart.series
    .map((item, i) => {
      const color = PRICING_CHART_LINE_COLORS[i % PRICING_CHART_LINE_COLORS.length]
      return `<div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#475569;min-width:0;">
        <span style="flex-shrink:0;width:10px;height:10px;border-radius:9999px;background:${color}"></span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escText(item.row.serviceName)}</span>
      </div>`
    })
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 300" width="100%" style="max-width:860px;height:auto;display:block;" role="img" aria-label="Service price trend by period">
    ${gridLines}
    ${periodLabels}
    <text x="20" y="54" font-size="11" fill="#64748b">${escText(fmtAxis(chart.max))}</text>
    <text x="20" y="226" font-size="11" fill="#64748b">${escText(fmtAxis(chart.min))}</text>
    ${polylines}
  </svg>`

  return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:16px;background:#fafafa;">
    ${svg}
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 12px;margin-top:12px;">${legend}</div>
  </div>`
}
