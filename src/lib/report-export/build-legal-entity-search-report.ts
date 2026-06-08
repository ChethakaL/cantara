import { generateReportHtml, buildHtmlTable, buildFlagListHtml, buildInfoGrid, buildBulletList } from './generate-report-html'
import type { WS110Report, WS110Flag } from '@/types/ws1-10-types'

export function buildLegalEntitySearchReportHtml(report: WS110Report, flags: WS110Flag[], clientName: string): string {
  const dealRisks = flags.filter(f => f.severity === 'deal-risk')
  const negotiations = flags.filter(f => f.severity === 'negotiation')
  const informational = flags.filter(f => f.severity === 'informational')

  // KPIs
  const kpis = [
    { label: 'Entities Verified', value: String(report.entityStanding.length) },
    { label: 'Active UCC Filings', value: String(report.uccFilings.filter(u => u.status === 'active').length) },
    { label: 'Good Standing Certs', value: String(report.goodStandingCertificates.filter(c => c.status === 'valid').length) },
    { label: 'Trademarks', value: String(report.trademarkRecords.length) },
    { label: 'Deal-Risk Flags', value: String(dealRisks.length) },
  ]

  // Summary HTML
  const summaryParts: string[] = []
  if (report.buyerSummary.entityStandingOverview) {
    summaryParts.push(`<p><strong>Entity Standing:</strong> ${escapeHtml(report.buyerSummary.entityStandingOverview)}</p>`)
  }
  if (report.buyerSummary.uccExposureSummary) {
    summaryParts.push(`<p><strong>UCC Exposure:</strong> ${escapeHtml(report.buyerSummary.uccExposureSummary)}</p>`)
  }
  if (report.buyerSummary.trademarkProtection) {
    summaryParts.push(`<p><strong>Trademark Protection:</strong> ${escapeHtml(report.buyerSummary.trademarkProtection)}</p>`)
  }
  if (report.buyerSummary.transitionConsiderations) {
    summaryParts.push(`<p><strong>Transition:</strong> ${escapeHtml(report.buyerSummary.transitionConsiderations)}</p>`)
  }

  // Sections
  const sections = []

  // Entity Standing
  if (report.entityStanding.length > 0) {
    sections.push({
      title: 'Entity Standing Verification',
      content: buildHtmlTable(
        ['Entity Name', 'Type', 'State', 'Filing #', 'Status', 'Last Annual Report', 'Registered Agent'],
        report.entityStanding.map(e => [
          e.entityName, e.entityType, e.stateOfFormation, e.filingNumber,
          e.status.toUpperCase(), e.lastAnnualReportDate, e.registeredAgent,
        ])
      ) + (report.entityStanding.some(e => e.notes) ? '<h3 style="font-size:14px;font-weight:700;margin-top:16px;">Notes</h3>' +
        buildBulletList(report.entityStanding.filter(e => e.notes).map(e => `${e.entityName}: ${e.notes}`)) : ''),
    })
  }

  // UCC Filings
  if (report.uccFilings.length > 0) {
    sections.push({
      title: 'UCC Filings Analysis',
      content: buildHtmlTable(
        ['Filing #', 'Filing Date', 'Expiration', 'Debtor', 'Secured Party', 'Status', 'Amount'],
        report.uccFilings.map(u => [
          u.filingNumber, u.filingDate, u.expirationDate, u.debtorName,
          u.securedParty, u.status.toUpperCase(), u.amount || '—',
        ])
      ) + report.uccFilings.filter(u => u.collateralDescription).map(u =>
        `<div style="margin:8px 0;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:600;margin-bottom:4px;">Collateral — ${escapeHtml(u.filingNumber)}</p>
          <p style="font-size:12px;color:#334155;">${escapeHtml(u.collateralDescription)}</p>
        </div>`
      ).join(''),
    })
  }

  // Registered Agents
  if (report.registeredAgentStatus.length > 0) {
    sections.push({
      title: 'Registered Agent Status',
      content: buildHtmlTable(
        ['Entity', 'Agent Name', 'Agent Address', 'Appointed', 'Status'],
        report.registeredAgentStatus.map(a => [
          a.entityName, a.agentName, a.agentAddress, a.appointmentDate, a.status.toUpperCase(),
        ])
      ),
    })
  }

  // Good Standing Certificates
  if (report.goodStandingCertificates.length > 0) {
    sections.push({
      title: 'Certificates of Good Standing',
      content: buildHtmlTable(
        ['Entity', 'State', 'Certificate Date', 'Expiration', 'Status'],
        report.goodStandingCertificates.map(c => [
          c.entityName, c.state, c.certificateDate, c.expirationDate || '—', c.status.toUpperCase(),
        ])
      ),
    })
  }

  // Trademarks
  if (report.trademarkRecords.length > 0) {
    sections.push({
      title: 'Trademark Search Results',
      content: buildHtmlTable(
        ['Mark', 'Reg #', 'Filed', 'Registered', 'Expires', 'Status', 'Class', 'Owner'],
        report.trademarkRecords.map(t => [
          t.markName, t.registrationNumber, t.filingDate, t.registrationDate,
          t.expirationDate, t.status.toUpperCase(), t.classOfGoods, t.owner,
        ])
      ),
    })
  }

  // Buyer Summary
  sections.push({
    title: 'Buyer-Facing Legal Standing Summary',
    content: buildInfoGrid([
      { label: 'Entity Standing', value: report.buyerSummary.entityStandingOverview },
      { label: 'UCC Exposure', value: report.buyerSummary.uccExposureSummary },
      { label: 'Registered Agent', value: report.buyerSummary.registeredAgentCompliance },
      { label: 'Good Standing', value: report.buyerSummary.goodStandingStatus },
      { label: 'Trademark Protection', value: report.buyerSummary.trademarkProtection },
      { label: 'Transition', value: report.buyerSummary.transitionConsiderations },
    ]) + (report.buyerSummary.counselItems.length > 0
      ? '<h3 style="font-size:14px;font-weight:700;margin-top:16px;color:#21263C;">Items Requiring Legal Counsel Review</h3>' +
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
    title: 'Legal Reports & Entity Search',
    subtitle: 'Corporate Entity Verification & Legal Standing Analysis',
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
