import type { WS18Report, WS18Flag } from '@/types/ws1-8-types'
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

export function buildOwnershipVerificationReportHtml(
  report: WS18Report,
  flags: WS18Flag[],
  clientName: string,
): string {
  const dealRisks = flags.filter(f => f.severity === 'deal-risk')
  const activeEncumbrances = report.encumbrances.filter(e => e.status === 'active')
  const compliantFilings = report.stateFilings.filter(f => f.complianceStatus === 'compliant')

  // KPIs
  const kpis = [
    { label: 'Entities', value: String(report.entities.length) },
    { label: 'Owners', value: String(report.ownershipStakes.length) },
    { label: 'Active Encumbrances', value: String(activeEncumbrances.length) },
    { label: 'Filing Compliance', value: report.stateFilings.length > 0 ? `${Math.round((compliantFilings.length / report.stateFilings.length) * 100)}%` : 'N/A' },
    { label: 'Deal-Risk Flags', value: String(dealRisks.length) },
  ]

  const bs = report.buyerSummary
  const escape = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const summaryItems = [
    { heading: 'Entity Structure Overview', text: bs.entityStructureOverview },
    { heading: 'Ownership Clarity', text: bs.ownershipClarity },
    { heading: 'Encumbrance Exposure', text: bs.encumbranceExposure },
    { heading: 'State Compliance Status', text: bs.stateComplianceStatus },
    { heading: 'Transition Considerations', text: bs.transitionConsiderations },
  ].filter(item => item.text)
  const executiveSummaryHtml = summaryItems
    .map(
      item =>
        `<p style="margin:0 0 14px 0;font-size:13px;line-height:1.7;color:#475569;"><strong style="color:#1e293b;font-size:13px;">${item.heading}</strong><br/>${escape(item.text ?? '')}</p>`
    )
    .join('')
  const shortSummary = bs.entityStructureOverview || ''

  // Documents table
  const docsContent = report.documents.length > 0
    ? buildHtmlTable(
        ['Filename', 'Type', 'Entities/Parties', 'Date', 'Status'],
        report.documents.map(d => [
          d.filename,
          d.docType,
          d.partiesCovered,
          d.date || '\u2014',
          d.status,
        ]),
      )
    : '<p>No documents inventoried.</p>'

  // Entities table
  const entitiesContent = report.entities.length > 0
    ? buildHtmlTable(
        ['Entity Name', 'Type', 'State', 'Formation Date', 'EIN', 'Status'],
        report.entities.map(e => [
          e.entityName,
          e.entityType,
          e.stateOfFormation,
          e.dateOfFormation,
          e.ein || '\u2014',
          e.status,
        ]),
      )
    : '<p>No entities identified.</p>'

  // Ownership table
  const ownershipContent = report.ownershipStakes.length > 0
    ? buildHtmlTable(
        ['Owner', 'Type', 'Entity', 'Ownership %', 'Class', 'Voting', 'Transfer Restrictions'],
        report.ownershipStakes.map(s => [
          s.ownerName,
          s.ownerType,
          s.entityOwned,
          s.ownershipPercentage,
          s.classOfInterest,
          s.votingRights,
          s.transferRestrictions,
        ]),
      )
    : '<p>No ownership stakes identified.</p>'

  // Encumbrances table
  const encumbrancesContent = report.encumbrances.length > 0
    ? buildHtmlTable(
        ['Type', 'Filed Against', 'Secured Party', 'Filing Date', 'Status', 'Collateral', 'Amount'],
        report.encumbrances.map(e => [
          e.type,
          e.filedAgainst,
          e.securedParty,
          e.filingDate,
          e.status,
          e.collateralDescription,
          e.amount || '\u2014',
        ]),
      )
    : '<p>No encumbrances or liens identified.</p>'

  // State Filings table
  const filingsContent = report.stateFilings.length > 0
    ? buildHtmlTable(
        ['State', 'Filing Type', 'Filing Date', 'Expiration', 'Status', 'Compliance', 'Notes'],
        report.stateFilings.map(f => [
          f.state,
          f.filingType,
          f.filingDate,
          f.expirationDate,
          f.status,
          f.complianceStatus,
          f.notes || '\u2014',
        ]),
      )
    : '<p>No state filings reviewed.</p>'

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
    title: 'Corporate Ownership Verification Report',
    subtitle: 'WS1-8 Analysis',
    clientName,
    generatedAt: report.generatedAt,
    summary: shortSummary,
    kpis,
    sections: [
      { title: 'Executive Summary', content: executiveSummaryHtml || '<p>No summary available.</p>' },
      { title: 'Document Inventory', content: docsContent },
      { title: 'Entity Structure', content: entitiesContent },
      { title: 'Ownership Breakdown', content: ownershipContent },
      { title: 'Encumbrances & Liens', content: encumbrancesContent },
      { title: 'State Filing Compliance', content: filingsContent },
      { title: 'Flags & Risk Items', content: flagsContent },
      { title: 'Counsel Items', content: counselContent },
    ],
  }

  return generateReportHtml(config)
}
