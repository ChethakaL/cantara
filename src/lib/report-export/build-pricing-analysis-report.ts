import {
  generateReportHtml,
  buildBulletList,
  type ReportConfig,
} from './generate-report-html'
import type { PricingAnalysisReport } from '@/lib/pricing-analysis/types'
import { getCompetitorNamesFromReport } from '@/lib/pricing-analysis/normalize-report'

function statusLabel(status: string): string {
  switch (status) {
    case 'underpriced': return 'Underpriced'
    case 'at-market': return 'At Market'
    case 'premium': return 'Premium'
    default: return 'Unknown'
  }
}

function statusStyle(status: string): string {
  switch (status) {
    case 'underpriced': return 'color:#b91c1c;font-weight:700'
    case 'at-market': return 'color:#166534;font-weight:700'
    case 'premium': return 'color:#1d4ed8;font-weight:700'
    default: return 'color:#64748b'
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

function buildPriceMatrixHtml(report: PricingAnalysisReport): string {
  const rows = report.priceMatrix ?? []
  if (!rows.length) return '<p>No price matrix data available.</p>'

  const competitorNames = getCompetitorNamesFromReport(report)

  // Header row 1 - main headers
  let header1 = '<th>Service</th><th>Basis</th>'
  header1 += '<th style="background:#fef9c3;text-align:right;">Your Price</th>'
  header1 += '<th style="background:#fef9c3;text-align:right;">Norm. Daily</th>'
  for (const name of competitorNames) {
    header1 += `<th colspan="2" style="background:#dcfce7;text-align:center;border-left:1px solid #e2e8f0;">${escapeHtml(name)}</th>`
  }

  // Header row 2 - sub-headers
  let header2 = '<th></th><th></th><th style="background:#fef9c3;"></th><th style="background:#fef9c3;"></th>'
  for (const _name of competitorNames) {
    header2 += '<th style="background:#dcfce7;font-size:10px;text-align:right;border-left:1px solid #e2e8f0;">Listed</th>'
    header2 += '<th style="background:#dcfce7;font-size:10px;text-align:right;">Norm.</th>'
  }

  const body = rows.map(row => {
    const compMap = new Map(row.competitors.map(c => [c.name, c]))
    let cells = `<td><strong>${escapeHtml(row.service)}</strong></td>`
    cells += `<td>${escapeHtml(row.basis)}</td>`
    cells += `<td style="background:#fef9c3;font-weight:700;text-align:right;">${escapeHtml(row.sellerPrice)}</td>`
    cells += `<td style="background:#fef9c3;font-weight:700;text-align:right;">${escapeHtml(row.sellerNormalized)}</td>`

    for (const name of competitorNames) {
      const comp = compMap.get(name)
      cells += `<td style="background:#f0fdf4;text-align:right;border-left:1px solid #e2e8f0;">${escapeHtml(comp?.listedPrice ?? '--')}</td>`
      const normDisplay = comp?.normalized ?? '--'
      const noteDisplay = comp?.normalizationNote ? `<br/><span style="font-size:9px;color:#94a3b8;">${escapeHtml(comp.normalizationNote)}</span>` : ''
      cells += `<td style="background:#f0fdf4;text-align:right;">${escapeHtml(normDisplay)}${noteDisplay}</td>`
    }

    return `<tr>${cells}</tr>`
  }).join('')

  return `<table class="report-table">
    <thead><tr>${header1}</tr><tr>${header2}</tr></thead>
    <tbody>${body}</tbody>
  </table>`
}

function buildSummaryTableHtml(report: PricingAnalysisReport): string {
  const rows = report.pricingSummary ?? []
  if (!rows.length) return '<p>No pricing summary data available.</p>'

  const header = '<th>Service</th><th style="text-align:right;">Your Price</th><th style="text-align:right;">Comp. Average</th><th style="text-align:right;">Variance</th><th style="text-align:center;">Status</th><th style="text-align:right;">Est. Annual Uplift</th>'

  const body = rows.map(row => {
    const style = statusStyle(row.status)
    return `<tr>
      <td><strong>${escapeHtml(row.service)}</strong></td>
      <td style="text-align:right;">${escapeHtml(row.sellerPrice)}</td>
      <td style="text-align:right;">${escapeHtml(row.competitorAvg)}</td>
      <td style="text-align:right;font-weight:700;">${escapeHtml(row.variance)}</td>
      <td style="text-align:center;${style}">${escapeHtml(statusLabel(row.status))}</td>
      <td style="text-align:right;">${escapeHtml(row.estAnnualUplift)}</td>
    </tr>`
  }).join('')

  return `<table class="report-table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`
}

export function buildPricingAnalysisReportHtml(
  report: PricingAnalysisReport,
  clientName: string,
): string {
  const underpricedCount = (report.pricingSummary ?? []).filter(s => s.status === 'underpriced').length

  // KPIs
  const kpis = [
    { label: 'Competitors Analyzed', value: String(report.competitorsAnalyzed) },
    { label: 'Services Compared', value: String((report.pricingSummary ?? []).length) },
    { label: 'Underpriced Services', value: String(underpricedCount) },
    { label: 'Total Est. Uplift', value: report.totalEstimatedUplift },
  ]

  // Price Matrix table
  const priceMatrixHtml = buildPriceMatrixHtml(report)

  // Summary & Variance table
  const summaryTableHtml = buildSummaryTableHtml(report)

  // Total Uplift card
  const upliftContent = `<div style="margin-top:12px;padding:16px;background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;">
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
      { title: 'Detailed Competitor Price Matrix', content: priceMatrixHtml },
      { title: 'Pricing Summary & Variance', content: summaryTableHtml },
      { title: 'Estimated Revenue Uplift', content: upliftContent },
      { title: 'Pricing Flags', content: flagsContent },
      { title: 'Recommendations', content: recsContent },
    ],
  }

  return generateReportHtml(config)
}
