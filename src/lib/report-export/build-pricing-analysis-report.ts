import {
  generateReportHtml,
  buildHtmlTable,
  buildBulletList,
  type ReportConfig,
} from './generate-report-html'
import type { PricingAnalysisReport } from '@/lib/pricing-analysis/types'

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
    title: 'Competitor Pricing Analysis',
    subtitle: 'Detailed Website-Based Competitor Comparison & Revenue Uplift Assessment',
    clientName,
    generatedAt: report.generatedAt,
    summary: report.executiveSummary,
    kpis,
    flags: flagCounts,
    sections: [
      { title: 'Competitor Service Inventory', content: competitorInventoryTable },
      { title: 'Service Pricing Comparison', content: comparisonTable },
      { title: 'Revenue Uplift Analysis', content: upliftContent },
      { title: 'Pricing Flags', content: flagsContent },
      { title: 'Recommendations', content: recsContent },
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
