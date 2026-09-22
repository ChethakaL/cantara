import type { WS16Report, Flag } from '@/types/ws1-6-types'
import {
  generateReportHtml,
  buildHtmlTable,
  type ReportConfig,
} from './generate-report-html'

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char))
}

function flagStatusLabel(status: string): string {
  switch (status) {
    case 'confirmed': return 'Verified';
    case 'na': return 'Not Applicable';
    case 'pending': return 'Pending Review';
    default: return status;
  }
}

function flagSeverityBadge(severity: string): string {
  const styles: Record<string, { bg: string; color: string; border: string; dot: string; label: string }> = {
    'deal-risk': { bg: '#fef2f2', color: '#b91c1c', border: '#fecaca', dot: '#ef4444', label: 'Deal Risk' },
    negotiation: { bg: '#fffbeb', color: '#a16207', border: '#fde68a', dot: '#eab308', label: 'Negotiation' },
    positive: { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', dot: '#22c55e', label: 'Positive' },
    informational: { bg: '#f8fafc', color: '#475569', border: '#cbd5e1', dot: '#94a3b8', label: 'Informational' },
  }
  const style = styles[severity] ?? styles.informational
  return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border:1px solid ${style.border};border-radius:999px;background:${style.bg};color:${style.color};font-size:11px;font-weight:700;white-space:nowrap;"><span style="width:6px;height:6px;border-radius:50%;background:${style.dot};display:inline-block;"></span>${style.label}</span>`
}

export function buildEmployeeObligationsReportHtml(
  report: WS16Report,
  flags: Flag[],
  clientName: string,
  hiddenSections: string[] = [],
): string {
  const confirmed = flags.filter(f => f.status === 'confirmed')
  const dealRisks = flags.filter(f => f.severity === 'deal-risk')
  const negotiation = flags.filter(f => f.severity === 'negotiation')

  // KPIs
  const kpis = [
    { label: 'Documents', value: String(report.documents.length) },
    { label: 'Agreements', value: String(report.agreements.length) },
    { label: 'Key People', value: String(report.keyPeople.length) },
    { label: 'Deal-Risk Flags', value: String(dealRisks.length) },
    { label: 'Coverage Gaps', value: String(report.coverageGaps.length) },
  ]

  // Buyer Summary — structured with bold subheadings for the Executive Summary section
  const bs = report.buyerSummary
  const summaryItems = [
    { heading: 'Workforce Overview', text: bs.workforceOverview },
    { heading: 'Non-Compete Protections', text: bs.nonCompeteProtections },
    { heading: 'Benefit Obligations', text: bs.assumedBenefitObligations },
    { heading: 'Retirement & PTO', text: bs.retirementAndPTO },
    { heading: 'Independent Contractor Risk', text: bs.independentContractorRisk },
    { heading: 'Transition Considerations', text: bs.transitionConsiderations },
  ].filter(item => item.text)
  const executiveSummaryHtml = summaryItems
    .map(item => `<p style="margin:0 0 14px 0;font-size:13px;line-height:1.7;color:#475569;"><strong style="color:#1e293b;font-size:13px;">${item.heading}</strong><br/>${(item.text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('')
  const shortSummary = bs.workforceOverview || ''

  // Documents table
  const docsContent = report.documents.length > 0
    ? buildHtmlTable(
        ['Filename', 'Type', 'Parties', 'Date', 'Status'],
        report.documents.map(d => [
          d.filename,
          d.docType,
          d.partiesCovered,
          d.date || '\u2014',
          d.status,
        ]),
      )
    : '<p>No documents inventoried.</p>'

  // Agreements table
  const agreementsContent = report.agreements.length > 0
    ? buildHtmlTable(
        ['Role', 'Agreement Type', 'Term', 'Non-Compete', 'Non-Solicit', 'NDA'],
        report.agreements.map(a => [
          a.role,
          a.agreementType,
          a.term,
          a.hasNonCompete === null ? 'Unknown' : a.hasNonCompete ? 'Yes' : 'No',
          a.hasNonSolicit === null ? 'Unknown' : a.hasNonSolicit ? 'Yes' : 'No',
          a.hasNDA === null ? 'Unknown' : a.hasNDA ? 'Yes' : 'No',
        ]),
      )
    : '<p>No agreements found.</p>'

  // Benefits table
  const benefitsContent = report.benefits.length > 0
    ? buildHtmlTable(
        ['Benefit', 'Employer Contribution', 'Bound', 'Transferable', 'Est. Annual Cost', 'Complexity'],
        report.benefits.map(b => [
          b.benefitType,
          b.employerContribution,
          b.contractuallyBound === null ? 'Unknown' : b.contractuallyBound ? 'Yes' : 'No',
          b.assetSaleTransferable,
          b.estimatedAnnualCost,
          b.transitionComplexity,
        ]),
      )
    : '<p>No benefits identified.</p>'

  // Key People table
  const keyPeopleContent = report.keyPeople.length > 0
    ? buildHtmlTable(
        ['Role', 'Employment Type', 'Non-Compete', 'Agreement', 'Risk Level', 'Transition Notes'],
        report.keyPeople.map(k => [
          k.role,
          k.employmentType,
          k.hasNonCompete === null ? 'Unknown' : k.hasNonCompete ? 'Yes' : 'No',
          k.hasAgreement === null ? 'Unknown' : k.hasAgreement ? 'Yes' : 'No',
          k.riskLevel,
          k.transitionNotes,
        ]),
      )
    : '<p>No key people identified.</p>'

  // Coverage Gaps
  const gapsContent = report.coverageGaps.length > 0
    ? buildHtmlTable(
        ['Category', 'Status', 'Reason', 'Note'],
        report.coverageGaps.map(g => [
          g.category,
          g.status,
          g.reason,
          g.note || '\u2014',
        ]),
      )
    : '<p>No coverage gaps identified.</p>'

  // Flags
  const flagsContent = flags.length > 0
    ? `<table class="report-table"><thead><tr><th>Domain</th><th>Severity</th><th>Title</th><th>Description</th><th>Advisor Review</th></tr></thead><tbody>${flags.map(f => `<tr><td><strong>${escapeHtml(f.domain)}</strong></td><td>${flagSeverityBadge(f.severity)}</td><td>${escapeHtml(f.title)}</td><td>${escapeHtml(f.description)}</td><td>${escapeHtml(flagStatusLabel(f.status))}</td></tr>`).join('')}</tbody></table>`
    : '<p>No flags raised.</p>'

  const config: ReportConfig = {
    title: 'Employee Obligations Report',
    subtitle: 'WS1-6 Analysis',
    clientName,
    generatedAt: report.generatedAt,
    summary: shortSummary,
    kpis,
    sections: [
      { title: 'Executive Summary', content: executiveSummaryHtml },
      { title: 'Document Inventory', content: docsContent },
      { title: 'Employment Agreements', content: agreementsContent },
      { title: 'Benefits & Obligations', content: benefitsContent },
      { title: 'Key People', content: keyPeopleContent },
      { title: 'Coverage Gaps', content: gapsContent },
      { title: 'Flags & Risk Items', content: flagsContent },
      // Counsel Items are intentionally excluded from the final PDF per client feedback.
    ].filter(section => !hiddenSections.includes(section.title) && section.title !== 'Counsel Items'),
  }

  return generateReportHtml(config)
}
