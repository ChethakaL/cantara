import type { WS16Report, Flag } from '@/types/ws1-6-types'
import {
  generateReportHtml,
  buildHtmlTable,
  buildBulletList,
  type ReportConfig,
} from './generate-report-html'

function flagStatusLabel(status: string): string {
  switch (status) {
    case 'confirmed': return 'Verified';
    case 'na': return 'Not Applicable';
    case 'pending': return 'Pending Review';
    default: return status;
  }
}

export function buildEmployeeObligationsReportHtml(
  report: WS16Report,
  flags: Flag[],
  clientName: string,
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

  // Buyer Summary
  const bs = report.buyerSummary
  const summaryText = [
    bs.workforceOverview,
    bs.nonCompeteProtections ? `Non-Compete Protections: ${bs.nonCompeteProtections}` : '',
    bs.assumedBenefitObligations ? `Benefit Obligations: ${bs.assumedBenefitObligations}` : '',
    bs.retirementAndPTO ? `Retirement & PTO: ${bs.retirementAndPTO}` : '',
    bs.independentContractorRisk ? `IC Risk: ${bs.independentContractorRisk}` : '',
    bs.transitionConsiderations ? `Transition: ${bs.transitionConsiderations}` : '',
  ].filter(Boolean).join(' | ')

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
    ? buildHtmlTable(
        ['Domain', 'Severity', 'Title', 'Description', 'Advisor Review'],
        flags.map(f => [
          f.domain,
          f.severity.charAt(0).toUpperCase() + f.severity.slice(1),
          f.title,
          f.description,
          flagStatusLabel(f.status),
        ]),
      )
    : '<p>No flags raised.</p>'

  // Counsel Items
  const counselContent = bs.counselItems.length > 0
    ? buildBulletList(bs.counselItems)
    : '<p>No counsel items noted.</p>'

  const config: ReportConfig = {
    title: 'Employee Obligations Report',
    subtitle: 'WS1-6 Analysis',
    clientName,
    generatedAt: report.generatedAt,
    summary: summaryText,
    kpis,
    sections: [
      { title: 'Document Inventory', content: docsContent },
      { title: 'Employment Agreements', content: agreementsContent },
      { title: 'Benefits & Obligations', content: benefitsContent },
      { title: 'Key People', content: keyPeopleContent },
      { title: 'Coverage Gaps', content: gapsContent },
      { title: 'Flags & Risk Items', content: flagsContent },
      { title: 'Counsel Items', content: counselContent },
    ],
  }

  return generateReportHtml(config)
}
