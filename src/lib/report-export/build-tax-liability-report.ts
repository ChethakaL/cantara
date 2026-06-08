import { generateReportHtml, buildHtmlTable, buildFlagListHtml, buildInfoGrid, buildBulletList } from './generate-report-html'
import type { WS111Report, WS111Flag } from '@/types/ws1-11-types'

export function buildTaxLiabilityReportHtml(report: WS111Report, flags: WS111Flag[], clientName: string): string {
  const dealRisks = flags.filter(f => f.severity === 'deal-risk')
  const negotiations = flags.filter(f => f.severity === 'negotiation')
  const informational = flags.filter(f => f.severity === 'informational')

  const totalLiabilities = report.outstandingLiabilities.length
  const openAudits = report.auditHistory.filter(a => a.status === 'in-progress').length
  const trustFundIssues = report.payrollTaxReview.filter(p => p.trustFundIssue === 'yes').length

  const kpis = [
    { label: 'Tax Years Reviewed', value: String(report.taxReturnSummary.length) },
    { label: 'Outstanding Liabilities', value: String(totalLiabilities) },
    { label: 'Open Audits', value: String(openAudits) },
    { label: 'Trust Fund Issues', value: String(trustFundIssues) },
    { label: 'Deal-Risk Flags', value: String(dealRisks.length) },
    { label: 'Est. Total Exposure', value: report.buyerSummary.estimatedTotalExposure || '—' },
  ]

  const summaryParts: string[] = []
  if (report.buyerSummary.overallTaxHealthAssessment) {
    summaryParts.push(`<p><strong>Tax Health:</strong> ${escapeHtml(report.buyerSummary.overallTaxHealthAssessment)}</p>`)
  }
  if (report.buyerSummary.outstandingLiabilitySummary) {
    summaryParts.push(`<p><strong>Liabilities:</strong> ${escapeHtml(report.buyerSummary.outstandingLiabilitySummary)}</p>`)
  }
  if (report.buyerSummary.dealStructureRecommendations) {
    summaryParts.push(`<p><strong>Deal Structure:</strong> ${escapeHtml(report.buyerSummary.dealStructureRecommendations)}</p>`)
  }

  const sections = []

  // Tax Return Summary
  if (report.taxReturnSummary.length > 0) {
    sections.push({
      title: 'Tax Return Summary',
      content: buildHtmlTable(
        ['Tax Year', 'Entity', 'Return Type', 'Filing Status', 'Gross Revenue', 'Taxable Income', 'Tax Due', 'Tax Paid', 'Balance'],
        report.taxReturnSummary.map(r => [
          r.taxYear, r.entityName, r.returnType, r.filingStatus.toUpperCase(),
          r.grossRevenue, r.taxableIncome, r.totalTaxDue, r.totalTaxPaid, r.balanceDue || '—',
        ])
      ),
    })
  }

  // Outstanding Liabilities
  if (report.outstandingLiabilities.length > 0) {
    sections.push({
      title: 'Outstanding Tax Liabilities',
      content: buildHtmlTable(
        ['Type', 'Description', 'Year(s)', 'Original Amount', 'Current Balance', 'P&I', 'Status', 'Lien Filed'],
        report.outstandingLiabilities.map(l => [
          l.type.toUpperCase(), l.description, l.taxYear, l.originalAmount,
          l.currentBalance, l.penaltiesInterest, l.status.toUpperCase(), l.lienFiled.toUpperCase(),
        ])
      ) + report.outstandingLiabilities.filter(l => l.paymentPlan === 'yes').map(l =>
        `<div style="margin:8px 0;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:600;margin-bottom:4px;">Payment Plan — ${escapeHtml(l.description)}</p>
          <p style="font-size:12px;color:#334155;">${escapeHtml(l.paymentPlanDetails)}</p>
        </div>`
      ).join(''),
    })
  }

  // Audit History
  if (report.auditHistory.length > 0) {
    sections.push({
      title: 'Audit History & Correspondence',
      content: buildHtmlTable(
        ['Authority', 'Year(s)', 'Audit Type', 'Status', 'Adjustment', 'Add\'l Tax', 'Penalties', 'Initiated', 'Closed'],
        report.auditHistory.map(a => [
          a.taxAuthority, a.taxYearsAudited, a.auditType, a.status.toUpperCase(),
          a.adjustmentAmount || '—', a.additionalTaxAssessed || '—', a.penalties || '—',
          a.dateInitiated, a.dateClosed || 'Open',
        ])
      ) + report.auditHistory.filter(a => a.outcome).map(a =>
        `<div style="margin:8px 0;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:600;margin-bottom:4px;">Outcome — ${escapeHtml(a.taxAuthority)} (${escapeHtml(a.taxYearsAudited)})</p>
          <p style="font-size:12px;color:#334155;">${escapeHtml(a.outcome)}</p>
        </div>`
      ).join(''),
    })
  }

  // State & Local Compliance
  if (report.stateLocalCompliance.length > 0) {
    sections.push({
      title: 'State & Local Tax Compliance',
      content: buildHtmlTable(
        ['State', 'Tax Type', 'Filing Status', 'Nexus', 'Last Filed', 'Outstanding Balance'],
        report.stateLocalCompliance.map(s => [
          s.state, s.taxType, s.filingStatus.toUpperCase(), s.nexusEstablished.toUpperCase(),
          s.lastFiledYear, s.outstandingBalance || '—',
        ])
      ),
    })
  }

  // Payroll Tax
  if (report.payrollTaxReview.length > 0) {
    sections.push({
      title: 'Payroll Tax Review',
      content: buildHtmlTable(
        ['Period', 'Type', 'Status', 'Amount Due', 'Amount Paid', 'Balance', 'Trust Fund Issue'],
        report.payrollTaxReview.map(p => [
          p.period, p.type, p.status.toUpperCase(), p.amountDue, p.amountPaid,
          p.balance || '—', p.trustFundIssue.toUpperCase(),
        ])
      ),
    })
  }

  // Deal Structure Implications
  if (report.dealStructureImplications.length > 0) {
    sections.push({
      title: 'Deal Structure Implications',
      content: report.dealStructureImplications.map(d =>
        `<div style="margin:8px 0;padding:14px;background:${d.risk === 'high' ? '#FEF2F2' : d.risk === 'medium' ? '#FFFBEB' : '#F0FDF4'};border:1px solid ${d.risk === 'high' ? '#FCA5A5' : d.risk === 'medium' ? '#FCD34D' : '#86EFAC'};border-radius:10px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${d.risk === 'high' ? '#b91c1c' : d.risk === 'medium' ? '#92400e' : '#166534'};">${escapeHtml(d.risk)} Risk — ${escapeHtml(d.area)}</span>
          </div>
          <p style="font-size:13px;color:#334155;margin-bottom:6px;">${escapeHtml(d.description)}</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
            <div style="font-size:11px;"><strong>Est. Exposure:</strong> ${escapeHtml(d.estimatedExposure)}</div>
            <div style="font-size:11px;"><strong>Impact:</strong> ${escapeHtml(d.dealStructureImpact)}</div>
          </div>
          <p style="font-size:11px;color:#475569;margin-top:6px;"><strong>Action:</strong> ${escapeHtml(d.recommendedAction)}</p>
        </div>`
      ).join(''),
    })
  }

  // Buyer Summary
  sections.push({
    title: 'Buyer-Facing Tax Liability Summary',
    content: buildInfoGrid([
      { label: 'Tax Health Assessment', value: report.buyerSummary.overallTaxHealthAssessment },
      { label: 'Outstanding Liabilities', value: report.buyerSummary.outstandingLiabilitySummary },
      { label: 'Audit Risk', value: report.buyerSummary.auditRiskAssessment },
      { label: 'State Compliance', value: report.buyerSummary.stateComplianceOverview },
      { label: 'Payroll Tax Status', value: report.buyerSummary.payrollTaxStatus },
      { label: 'Deal Structure', value: report.buyerSummary.dealStructureRecommendations },
      { label: 'Est. Total Exposure', value: report.buyerSummary.estimatedTotalExposure },
      { label: 'Transition', value: report.buyerSummary.transitionConsiderations },
    ]) + (report.buyerSummary.counselItems.length > 0
      ? '<h3 style="font-size:14px;font-weight:700;margin-top:16px;color:#21263C;">Items Requiring Tax Counsel Review</h3>' +
        buildBulletList(report.buyerSummary.counselItems)
      : ''),
  })

  // Flags
  if (flags.length > 0) {
    sections.push({
      title: 'Flag Summary',
      content:
        (dealRisks.length > 0 ? '<h3 style="font-size:13px;font-weight:700;color:#b91c1c;margin-bottom:8px;">Deal-Risk Flags</h3>' +
          buildFlagListHtml(dealRisks.map(f => ({ issue: f.title, whyItMatters: f.description })), 'red') : '') +
        (negotiations.length > 0 ? '<h3 style="font-size:13px;font-weight:700;color:#92400e;margin-top:16px;margin-bottom:8px;">Negotiation Flags</h3>' +
          buildFlagListHtml(negotiations.map(f => ({ issue: f.title, whyItMatters: f.description })), 'orange') : '') +
        (informational.length > 0 ? '<h3 style="font-size:13px;font-weight:700;color:#166534;margin-top:16px;margin-bottom:8px;">Informational Flags</h3>' +
          buildFlagListHtml(informational.map(f => ({ issue: f.title, whyItMatters: f.description })), 'green') : ''),
    })
  }

  return generateReportHtml({
    title: 'Tax Liability Review',
    subtitle: 'Tax Compliance & Liability Due Diligence Analysis',
    clientName,
    generatedAt: report.generatedAt,
    kpis,
    summaryHtml: summaryParts.join(''),
    flags: { red: dealRisks.length, orange: negotiations.length, green: informational.length },
    sections,
  })
}

function escapeHtml(str: string | null | undefined): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
