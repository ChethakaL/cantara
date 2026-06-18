import {
  generateReportHtml,
  buildBulletList,
  type ReportConfig,
} from './generate-report-html'
import type { PricingAnalysisReport } from '@/lib/pricing-analysis/types'
import { getCompetitorNamesFromReport } from '@/lib/pricing-analysis/normalize-report'
import { classifyPricingService } from '@/lib/pricing-analysis/service-vertical'

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
  for (const name of competitorNames) {
    header1 += `<th style="background:#dcfce7;text-align:center;border-left:1px solid #e2e8f0;">${escapeHtml(name)}</th>`
  }

  // Header row 2 - sub-headers
  let header2 = '<th></th><th></th><th style="background:#fef9c3;"></th>'
  for (const _name of competitorNames) {
    header2 += '<th style="background:#dcfce7;font-size:10px;text-align:right;border-left:1px solid #e2e8f0;">Price</th>'
  }

  const body = rows.map(row => {
    const compMap = new Map(row.competitors.map(c => [c.name, c]))
    let cells = `<td><strong>${escapeHtml(row.service)}</strong></td>`
    cells += `<td>${escapeHtml(row.basis)}</td>`
    cells += `<td style="background:#fef9c3;font-weight:700;text-align:right;">${escapeHtml(row.sellerPrice)}</td>`

    for (const name of competitorNames) {
      const comp = compMap.get(name)
      cells += `<td style="background:#f0fdf4;text-align:right;border-left:1px solid #e2e8f0;">${escapeHtml(comp?.listedPrice ?? '--')}</td>`
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

  const header = '<th>Service</th><th style="text-align:right;">Your Price</th><th style="text-align:right;">Comp. Average</th><th style="text-align:right;">Variance</th><th style="text-align:center;">Status</th>'

  const body = rows.map(row => {
    const style = statusStyle(row.status)
    return `<tr>
      <td><strong>${escapeHtml(row.service)}</strong></td>
      <td style="text-align:right;">${escapeHtml(row.sellerPrice)}</td>
      <td style="text-align:right;">${escapeHtml(row.competitorAvg)}</td>
      <td style="text-align:right;font-weight:700;">${escapeHtml(row.variance)}</td>
      <td style="text-align:center;${style}">${escapeHtml(statusLabel(row.status))}</td>
    </tr>`
  }).join('')

  return `<table class="report-table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`
}

function buildChartsHtml(report: PricingAnalysisReport): string {
  const verticals = ['Boarding', 'Daycare', 'Grooming', 'Training']
  let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:16px;margin-top:12px;">'

  let totalCharts = 0
  for (const vertical of verticals) {
    const verticalRows = (report.priceMatrix ?? []).filter(row => classifyPricingService(row.service) === vertical)
    if (verticalRows.length === 0) continue
    totalCharts++

    html += `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;background:#ffffff;">
      <h4 style="margin-top:0;margin-bottom:12px;font-size:12px;text-transform:uppercase;color:#475569;letter-spacing:1px;border-bottom:1px solid #f1f5f9;padding-bottom:8px;">${vertical} Price Comparison</h4>
      <div style="display:flex;flex-direction:column;gap:12px;">`

    for (const row of verticalRows) {
      const parseVal = (val: string) => {
        const num = parseFloat(val.replace(/[^0-9.]/g, ''))
        return isNaN(num) ? 0 : num
      }
      const yourVal = parseVal(row.sellerPrice)
      const compVals = row.competitors.map(c => ({ name: c.name, val: parseVal(c.listedPrice) }))
      const maxVal = Math.max(yourVal, ...compVals.map(c => c.val), 1)

      html += `<div style="margin-bottom:8px;border-bottom:1px solid #f8fafc;padding-bottom:8px;">
        <div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:4px;">${escapeHtml(row.service)} (${escapeHtml(row.basis)})</div>
        <!-- Your Price bar -->
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <div style="width:80px;font-size:9px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Your Price</div>
          <div style="flex:1;height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden;position:relative;">
            <div style="height:100%;border-radius:5px;background:#f59e0b;width:${(yourVal / maxVal) * 100}%;"></div>
          </div>
          <div style="width:36px;text-align:right;font-size:9px;font-weight:700;color:#334155;">$${yourVal}</div>
        </div>`

      for (const cv of compVals) {
        html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;">
          <div style="width:80px;font-size:9px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(cv.name)}</div>
          <div style="flex:1;height:10px;background:#f1f5f9;border-radius:5px;overflow:hidden;position:relative;">
            <div style="height:100%;border-radius:5px;background:#94a3b8;width:${(cv.val / maxVal) * 100}%;"></div>
          </div>
          <div style="width:36px;text-align:right;font-size:9px;color:#475569;">$${cv.val || 'N/A'}</div>
        </div>`
      }

      html += '</div>'
    }

    html += '</div></div>'
  }

  html += '</div>'
  return totalCharts > 0 ? html : '<p>No service pricing data available for comparison charts.</p>'
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
  ]

  // Price Matrix table
  const priceMatrixHtml = buildPriceMatrixHtml(report)

  // Summary & Variance table
  const summaryTableHtml = buildSummaryTableHtml(report)

  // Comparison charts
  const chartsHtml = buildChartsHtml(report)

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
      { title: 'Pricing Comparison Charts', content: chartsHtml },
      { title: 'Pricing Flags', content: flagsContent },
      { title: 'Recommendations', content: recsContent },
    ],
  }

  return generateReportHtml(config)
}
