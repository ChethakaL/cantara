import {
  generateReportHtml,
  buildHtmlTable,
  buildBulletList,
  type ReportConfig,
} from './generate-report-html'
import type { PricingAnalysisReport } from '@/lib/pricing-analysis/types'
import { buildFullDayNormalizedRows } from '@/lib/pricing-analysis/day-normalization'

function statusColor(status: string): string {
  switch (status) {
    case 'underpriced': return 'color:#b91c1c;font-weight:700'
    case 'at-market': return 'color:#166534;font-weight:700'
    case 'premium': return 'color:#1d4ed8;font-weight:700'
    default: return 'color:#64748b'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'underpriced': return 'Underpriced'
    case 'at-market': return 'At Market'
    case 'premium': return 'Premium'
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

function escapeHtml(str: string | number | null | undefined): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function daycareRows(report: PricingAnalysisReport) {
  return (report.serviceComparisons ?? []).filter((item) =>
    /daycare|day camp|half day|full day|hour|package/i.test(`${item.serviceCategory} ${item.serviceDetail ?? ''} ${item.sellerServiceBasis ?? ''}`),
  )
}

function competitorNamesForMatrix(report: PricingAnalysisReport) {
  const names = report.competitors.map((item) => item.name).filter(Boolean)
  if (names.length) return names
  return Array.from(new Set((report.competitorServiceDetails ?? []).map((item) => item.competitorName).filter(Boolean))).slice(0, 5)
}

function buildDaycareMatrix(report: PricingAnalysisReport): string {
  const rows = daycareRows(report)
  if (!rows.length) return ''
  const competitors = competitorNamesForMatrix(report)
  const header = ['Item', report.businessName, 'Unit Price', ...competitors]
    .map((item) => `<th>${escapeHtml(item)}</th>`)
    .join('')
  const body = rows.map((row) => {
    const prices = new Map(row.competitorPrices.map((price) => [price.name, price.normalizedPrice || price.price]))
    return `<tr>
      <td><strong>${escapeHtml(row.serviceCategory)}</strong></td>
      <td style="background:#fef9c3;font-weight:700;text-align:right;">${escapeHtml(row.sellerPrice || 'N/A')}</td>
      <td style="text-align:right;">${escapeHtml(row.sellerNormalizedPrice || 'N/A')}</td>
      ${competitors.map((name) => `<td style="background:#dcfce7;text-align:right;">${escapeHtml(prices.get(name) ?? 'N/A')}</td>`).join('')}
    </tr>`
  }).join('')
  return `<table class="report-table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`
}

function buildFullDayNormalizedMatrix(report: PricingAnalysisReport): string {
  const rows = buildFullDayNormalizedRows(report)
  if (!rows.length) return ''
  const competitors = competitorNamesForMatrix(report)
  const header = ['Service', report.businessName, ...competitors]
    .map((item) => `<th>${escapeHtml(item)}</th>`)
    .join('')
  const body = rows.map((row) => `<tr>
      <td><strong>${escapeHtml(row.service)}</strong></td>
      <td style="background:#fef9c3;font-weight:700;text-align:right;">${escapeHtml(row.sellerPrice)}</td>
      ${competitors.map((name) => `<td style="background:#dcfce7;text-align:right;">${escapeHtml(row.competitors[name] ?? 'N/A')}</td>`).join('')}
    </tr>`).join('')
  return `<table class="report-table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
    <p style="font-size:10px;color:#64748b;margin-top:8px;">Half-day prices are doubled, hourly prices assume an 8-hour full day, and package prices are divided by the package day count.</p>`
}

export function buildPricingAnalysisReportHtml(
  report: PricingAnalysisReport,
  clientName: string,
): string {
  const underpricedCount = report.serviceComparisons.filter(s => s.status === 'underpriced').length

  // KPIs
  const kpis = [
    { label: 'Competitors Analyzed', value: String(report.competitorsAnalyzed) },
    { label: 'Services Compared', value: String(report.serviceComparisons.length) },
    { label: 'Underpriced Services', value: String(underpricedCount) },
    { label: 'Total Est. Uplift', value: report.totalEstimatedUplift },
  ]

  // Service Pricing Comparison table
  const comparisonTable = buildHtmlTable(
    ['Service', 'Specific Basis', 'Seller Price', 'Seller Normalized', 'Competitor Basis', 'Avg Across Competitors', 'Range', 'Variance', 'Status', 'Uplift Opportunity'],
    report.serviceComparisons.map(s => [
      s.serviceCategory,
      s.sellerServiceBasis || s.serviceDetail || '',
      s.sellerPrice,
      s.sellerNormalizedPrice || '',
      s.competitorServiceBasis || '',
      s.competitorAvgPrice,
      s.competitorRange,
      s.variance,
      statusLabel(s.status),
      s.upliftOpportunity,
    ]),
  )

  const competitorInventoryTable = buildHtmlTable(
    ['Competitor', 'Service', 'Category', 'Listed Price', 'Basis', 'Duration Hrs', 'Normalized $/Hr', 'Comparable To', 'Notes'],
    (report.competitorServiceDetails ?? []).map(s => [
      s.competitorName,
      s.serviceName,
      s.serviceCategory,
      s.listedPrice,
      s.serviceBasis,
      s.durationHours ?? 'N/A',
      s.normalizedPriceLabel,
      s.comparableToSellerService,
      s.notes,
    ]),
  )
  const daycareMatrix = buildDaycareMatrix(report)
  const fullDayNormalizedMatrix = buildFullDayNormalizedMatrix(report)

  // Revenue Uplift section
  const upliftContent = `<p>${escapeHtml(report.revenueUpliftSummary)}</p>
    <div style="margin-top:12px;padding:16px;background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;">
      <p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#166534;font-weight:700;margin-bottom:4px;">Total Estimated Annual Uplift</p>
      <p style="font-size:24px;font-weight:800;color:#166534;">${escapeHtml(report.totalEstimatedUplift)}</p>
    </div>`

  // Flags
  const flagsContent = report.flags.length > 0
    ? report.flags.map(f => `
        <div class="flag-item ${severityStyle(f.severity)}">
          <div class="flag-title">${escapeHtml(f.title)}</div>
          <div class="flag-detail">${escapeHtml(f.description)}</div>
        </div>`).join('\n')
    : '<p>No pricing flags identified.</p>'

  // Recommendations
  const recsContent = buildBulletList(report.recommendations)

  const flagCounts = {
    red: report.flags.filter(f => f.severity === 'critical').length,
    orange: report.flags.filter(f => f.severity === 'warning').length,
    green: report.flags.filter(f => f.severity === 'positive').length,
  }

  const config: ReportConfig = {
    title: 'Competitive Pricing Analysis',
    subtitle: 'Detailed Website-Based Competitor Comparison & Revenue Uplift Assessment',
    clientName,
    generatedAt: report.generatedAt,
    summary: report.executiveSummary,
    kpis,
    flags: flagCounts,
    sections: [
      ...(daycareMatrix ? [{ title: 'Daycare Competitive Pricing Matrix', content: daycareMatrix }] : []),
      ...(fullDayNormalizedMatrix ? [{ title: 'Full-Day Normalized Competitor Pricing', content: fullDayNormalizedMatrix }] : []),
      { title: 'Competitor Service Inventory', content: competitorInventoryTable },
      { title: 'Service Pricing Comparison', content: comparisonTable },
      { title: 'Revenue Uplift Analysis', content: upliftContent },
      { title: 'Pricing Flags', content: flagsContent },
      { title: 'Recommendations', content: recsContent },
    ],
  }

  return generateReportHtml(config)
}
