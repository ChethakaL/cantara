import {
  generateReportHtml,
  buildHtmlTable,
  type ReportConfig,
} from './generate-report-html'
import type { PricingVerticalReport } from '@/lib/pricing-vertical/types'
import { buildPricingTrendChartSectionHtml } from '@/lib/pricing-vertical/pricing-trend-chart'

function trendLabel(trend: string): string {
  switch (trend) {
    case 'increasing': return 'Increasing'
    case 'stable': return 'Stable'
    case 'decreasing': return 'Decreasing'
    default: return 'Unknown'
  }
}

function severityStyle(severity: string): string {
  switch (severity) {
    case 'critical': return 'red'
    case 'warning': return 'orange'
    case 'positive': return 'green'
    default: return 'green'
  }
}

function fmtInt(n: unknown): string {
  if (typeof n === 'number' && Number.isFinite(n)) return String(Math.trunc(n))
  if (typeof n === 'string' && /^\d+$/.test(n.trim())) return n.trim()
  return '—'
}

function fmtPct(n: number | null | undefined, digits = 1): string {
  return typeof n === 'number' && Number.isFinite(n) ? `${n.toFixed(digits)}%` : 'N/A'
}

export function buildPricingVerticalReportHtml(
  report: PricingVerticalReport,
  clientName: string,
): string {
  const noChangeCount = report.verticalSummaries.filter(v => Number(v.priceChanges24Mo) === 0).length
  const totalChanges = report.priceChanges.length
  const finiteAvg = (v: { avgChangePercent?: number | null }) =>
    typeof v.avgChangePercent === 'number' && Number.isFinite(v.avgChangePercent)
  const avgAnnualIncrease = report.verticalSummaries.length > 0
    ? report.verticalSummaries
        .filter(finiteAvg)
        .reduce((sum, v) => sum + (v.avgChangePercent as number), 0) /
      Math.max(1, report.verticalSummaries.filter(finiteAvg).length)
    : 0

  // KPIs
  const kpis = [
    { label: 'Verticals Analyzed', value: String(report.verticalSummaries.length) },
    { label: 'Price Changes (24mo)', value: String(totalChanges) },
    { label: 'Avg Annual Increase', value: avgAnnualIncrease > 0 ? `${avgAnnualIncrease.toFixed(1)}%` : 'N/A' },
    { label: 'Verticals with No Change', value: String(noChangeCount) },
  ]

  const periods = report.pricingPeriods?.length ? report.pricingPeriods : ['Current']
  const trendChartHtml = buildPricingTrendChartSectionHtml(report)
  const pricingGridTable = buildHtmlTable(
    ['Service', 'Vertical', ...periods],
    (report.pricingGrid ?? []).map(row => [
      row.serviceName,
      row.vertical,
      ...periods.map(period => row.prices?.[period] ?? ''),
    ]),
  )

  // Price Change Timeline table
  const timelineTable = buildHtmlTable(
    ['Date', 'Service', 'Previous Price', 'New Price', '$ Change', '% Change', 'Notes'],
    report.priceChanges.map(c => [
      c.date,
      c.serviceVertical,
      c.previousPrice,
      c.newPrice,
      c.dollarChange !== null ? (c.dollarChange >= 0 ? `+$${c.dollarChange.toFixed(2)}` : `-$${Math.abs(c.dollarChange).toFixed(2)}`) : 'N/A',
      c.percentChange !== null ? `${c.percentChange >= 0 ? '+' : ''}${c.percentChange.toFixed(1)}%` : 'N/A',
      c.notes,
    ]),
  )

  // Vertical-by-Vertical Analysis sections
  const verticalSections = report.verticalSummaries.map(v => {
    const trendBadgeColor = v.trend === 'increasing' ? '#166534' : v.trend === 'stable' ? '#92400e' : v.trend === 'decreasing' ? '#b91c1c' : '#64748b'
    const trendBadgeBg = v.trend === 'increasing' ? '#F0FDF4' : v.trend === 'stable' ? '#FFFBEB' : v.trend === 'decreasing' ? '#FEF2F2' : '#f8fafc'

    return `<div style="margin-bottom:16px;padding:16px;border:1px solid #e2e8f0;border-radius:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <p style="font-size:15px;font-weight:700;color:#1e293b;">${escapeHtml(String(v.vertical ?? 'Unknown'))}</p>
        <span style="display:inline-block;padding:4px 12px;border-radius:6px;font-size:11px;font-weight:700;background:${trendBadgeBg};color:${trendBadgeColor};border:1px solid ${trendBadgeColor}20;">${trendLabel(v.trend)}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:600;">Current Price</p>
          <p style="font-size:14px;font-weight:700;color:#1e293b;">${escapeHtml(String(v.currentPrice ?? '—'))}</p>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:600;">Changes (24mo)</p>
          <p style="font-size:14px;font-weight:700;color:#1e293b;">${fmtInt(v.priceChanges24Mo)}</p>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:600;">Avg Change %</p>
          <p style="font-size:13px;font-weight:600;color:#1e293b;">${fmtPct(v.avgChangePercent)}</p>
        </div>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:600;">Last Change</p>
          <p style="font-size:13px;font-weight:600;color:#1e293b;">${escapeHtml(String(v.lastChangeDate ?? '—'))}</p>
        </div>
      </div>
      ${typeof v.totalChangePercent === 'number' && Number.isFinite(v.totalChangePercent) ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;margin-bottom:10px;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:600;">Total change (24 mo)</p>
          <p style="font-size:13px;font-weight:600;color:#1e293b;">${fmtPct(v.totalChangePercent)}</p>
        </div>` : ''}
      <p style="font-size:12px;color:#475569;"><strong>Recommendation:</strong> ${escapeHtml(String(v.recommendation ?? '—'))}</p>
    </div>`
  }).join('\n')

  const activeFlags = report.flags.filter(f => f.resolution !== 'declined')

  // Flags (declined flags excluded from PDF, same as advisor queue)
  const flagsContent = activeFlags.length > 0
    ? activeFlags.map(f => `
        <div class="flag-item ${severityStyle(f.severity)}">
          <div class="flag-title">${escapeHtml(f.title)}</div>
          <div class="flag-detail">${escapeHtml(f.description)}</div>
        </div>`).join('\n')
    : '<p>No pricing flags identified.</p>'

  const flagCounts = {
    red: activeFlags.filter(f => f.severity === 'critical').length,
    orange: activeFlags.filter(f => f.severity === 'warning').length,
    green: activeFlags.filter(f => f.severity === 'positive').length,
  }

  const config: ReportConfig = {
    title: 'Pricing by Vertical Analysis',
    subtitle: '24-Month Price Change Analysis',
    clientName,
    generatedAt: report.generatedAt,
    summary: report.executiveSummary,
    kpis,
    flags: flagCounts,
    sections: [
      { title: 'Service Price Trend', content: trendChartHtml },
      { title: 'Editable 24-Month Pricing Grid', content: pricingGridTable },
      { title: 'Price Change Timeline', content: timelineTable },
      { title: 'Vertical-by-Vertical Analysis', content: verticalSections },
      { title: 'Pricing Flags', content: flagsContent },
    ],
  }

  return generateReportHtml(config)
}

function escapeHtml(str: string | number | null | undefined): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
