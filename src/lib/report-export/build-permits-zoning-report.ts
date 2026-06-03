import type { WS19Report, WS19Flag } from '@/types/ws1-9-types'
import {
  generateReportHtml,
  buildHtmlTable,
  buildBulletList,
  type ReportConfig,
} from './generate-report-html'
import {
  formatInlineMarkdown,
  formatStructuredExecutiveSummaryHtml,
  type SummaryBlockItem,
} from './format-report-markdown'

function flagStatusLabel(status: string): string {
  switch (status) {
    case 'confirmed': return 'Verified';
    case 'na': return 'Not Applicable';
    case 'pending': return 'Pending Review';
    default: return status;
  }
}

export function buildPermitsZoningReportHtml(
  report: WS19Report,
  flags: WS19Flag[],
  clientName: string,
): string {
  const dealRisks = flags.filter(f => f.severity === 'deal-risk')
  const expiredOrExpiring = report.permits.filter(p => p.status === 'Expired' || p.status === 'Expiring Soon')
  const cups = report.conditionalUsePermits
  const gfItems = report.grandfathering

  // KPIs
  const kpis = [
    { label: 'Total Permits', value: String(report.permits.length) },
    { label: 'Expired/Expiring', value: String(expiredOrExpiring.length) },
    { label: 'CUPs', value: String(cups.length) },
    { label: 'Grandfathered Items', value: String(gfItems.length) },
    { label: 'Deal-Risk Flags', value: String(dealRisks.length) },
  ]

  const bs = report.buyerSummary
  const summaryItems: SummaryBlockItem[] = [
    { heading: 'Permits Overview', text: bs.permitsOverview },
    { heading: 'Zoning Compliance', text: bs.zoningCompliance },
    { heading: 'Conditional Use Permit Status', text: bs.conditionalUseStatus },
    { heading: 'Grandfathering Risk', text: bs.grandfatheringRisk },
    { heading: 'Transfer Considerations', text: bs.transferConsiderations },
  ].filter(item => item.text?.trim())
  const executiveSummaryHtml = formatStructuredExecutiveSummaryHtml(summaryItems)

  // Documents table
  const docsContent = report.documents.length > 0
    ? buildHtmlTable(
        ['Filename', 'Type', 'Issuing Authority', 'Date', 'Status'],
        report.documents.map(d => [
          d.filename,
          d.docType,
          d.issuingAuthority,
          d.date || '\u2014',
          d.status,
        ]),
      )
    : '<p>No documents inventoried.</p>'

  // Permits table
  const permitsContent = report.permits.length > 0
    ? buildHtmlTable(
        ['Permit Type', 'Permit #', 'Authority', 'Issue Date', 'Expiration', 'Status', 'Renewal', 'Conditions'],
        report.permits.map(p => [
          p.permitType,
          p.permitNumber,
          p.issuingAuthority,
          p.issueDate || '\u2014',
          p.expirationDate || '\u2014',
          p.status,
          p.renewalProcess,
          p.conditions,
        ]),
      )
    : '<p>No permits identified.</p>'

  // Zoning
  const zoningContent = report.zoning.length > 0
    ? report.zoning.map(z =>
        `<div style="margin-bottom:12px;padding:8px;border:1px solid #e5e7eb;border-radius:4px;">
          <p><strong>Address:</strong> ${formatInlineMarkdown(z.propertyAddress)}</p>
          <p><strong>Zoning:</strong> ${formatInlineMarkdown(z.zoningDesignation)}</p>
          <p><strong>Current Use:</strong> ${formatInlineMarkdown(z.currentUse)}</p>
          <p><strong>Compliance:</strong> ${formatInlineMarkdown(z.complianceStatus)}</p>
          <p><strong>Permitted Uses:</strong> ${z.permittedUses.map(u => formatInlineMarkdown(u)).join(', ')}</p>
          ${z.restrictions.length > 0 ? `<p><strong>Restrictions:</strong></p><ul>${z.restrictions.map(r => `<li>${formatInlineMarkdown(r)}</li>`).join('')}</ul>` : ''}
        </div>`
      ).join('')
    : '<p>No zoning records found.</p>'

  // Conditional Use Permits
  const cupsContent = cups.length > 0
    ? cups.map(cup =>
        `<div style="margin-bottom:12px;padding:8px;border:1px solid #e5e7eb;border-radius:4px;">
          <p><strong>CUP #${cup.cupNumber}</strong> &mdash; ${cup.issuingAuthority}</p>
          <p><strong>Approved Use:</strong> ${cup.approvedUse}</p>
          <p><strong>Compliance:</strong> ${cup.complianceStatus}</p>
          <p><strong>Transferability:</strong> ${cup.transferability}</p>
          <p><strong>Renewal:</strong> ${cup.renewalRequired ? cup.renewalDate || 'Date not specified' : 'No renewal required'}</p>
          ${cup.conditions.length > 0 ? `<p><strong>Conditions:</strong></p><ol>${cup.conditions.map(c => `<li>${c}</li>`).join('')}</ol>` : ''}
        </div>`
      ).join('')
    : '<p>No conditional use permits identified.</p>'

  // Grandfathering
  const gfContent = gfItems.length > 0
    ? gfItems.map(gf =>
        `<div style="margin-bottom:12px;padding:8px;border:1px solid #e5e7eb;border-radius:4px;${gf.riskLevel === 'High' ? 'border-left:3px solid #f87171;' : ''}">
          <p><strong>${gf.nonConformingUse}</strong> &mdash; Risk: ${gf.riskLevel}</p>
          <p><strong>Original Date:</strong> ${gf.originalApprovalDate}</p>
          <p><strong>Legal Basis:</strong> ${gf.currentBasis}</p>
          ${gf.triggerEvents.length > 0 ? `<p><strong>Trigger Events:</strong></p><ul>${gf.triggerEvents.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
          <p><strong>Mitigation:</strong> ${gf.mitigationOptions}</p>
        </div>`
      ).join('')
    : '<p>No grandfathering issues identified.</p>'

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
    title: 'Business Permits & Zoning Report',
    subtitle: 'WS1-9 Analysis',
    clientName,
    generatedAt: report.generatedAt,
    kpis,
    sections: [
      { title: 'Executive Summary', content: executiveSummaryHtml || '<p>No summary available.</p>' },
      { title: 'Document Inventory', content: docsContent },
      { title: 'Permit Inventory', content: permitsContent },
      { title: 'Zoning Analysis', content: zoningContent },
      { title: 'Conditional Use Permits', content: cupsContent },
      { title: 'Grandfathering Analysis', content: gfContent },
      { title: 'Flags & Risk Items', content: flagsContent },
      { title: 'Counsel Items', content: counselContent },
    ],
  }

  return generateReportHtml(config)
}
