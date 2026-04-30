import type { ContractReport } from '@/lib/contract-analysis/types'
import {
  generateReportHtml,
  buildHtmlTable,
  buildFlagListHtml,
  type ReportConfig,
} from './generate-report-html'

export function buildContractReportHtml(report: ContractReport, clientName: string): string {
  const redFlags = report.redFlags || []
  const orangeFlags = report.orangeFlags || []
  const greenFlags = report.greenFlags || []

  // Snapshot table
  const snapshotRows = (report.snapshotTable || []).map(row => [
    row.field,
    row.finding,
    row.sourceSection,
  ])
  const snapshotContent = buildHtmlTable(['Field', 'Finding', 'Source'], snapshotRows)

  // Per-contract risk cards
  const riskCardsContent = (report.contractRiskCards || []).map(card => {
    const allFlags = [
      ...card.redFlags.map(f => ({ ...f, color: 'red' as const })),
      ...card.orangeFlags.map(f => ({ ...f, color: 'orange' as const })),
      ...card.greenFlags.map(f => ({ ...f, color: 'green' as const })),
    ]
    const flagHtml = allFlags.map(f =>
      `<div class="flag-item ${f.color}"><div class="flag-title">${escapeHtml(f.issue)}</div><div class="flag-detail">${escapeHtml(f.whyItMatters)}</div></div>`
    ).join('')

    return `<p><strong>${escapeHtml(card.contractName)}</strong> — Risk: ${escapeHtml(card.riskTier)}</p>
      <p style="font-size:12px;color:#475569;">${escapeHtml(card.recommendedAction)}</p>
      ${flagHtml}`
  }).join('<div style="height:12px"></div>')

  // Top-level flag section
  const flagsContent = [
    redFlags.length ? `<p style="font-weight:700;margin-top:8px;">Red Flags</p>` + buildFlagListHtml(redFlags, 'red') : '',
    orangeFlags.length ? `<p style="font-weight:700;margin-top:8px;">Orange Flags</p>` + buildFlagListHtml(orangeFlags, 'orange') : '',
    greenFlags.length ? `<p style="font-weight:700;margin-top:8px;">Green Flags</p>` + buildFlagListHtml(greenFlags, 'green') : '',
  ].join('')

  const config: ReportConfig = {
    title: 'Material Contracts Report',
    subtitle: 'Contract Risk Assessment',
    clientName,
    generatedAt: report.generatedAt,
    flags: {
      red: redFlags.length,
      orange: orangeFlags.length,
      green: greenFlags.length,
    },
    kpis: [
      { label: 'Contracts', value: String((report.contractRiskCards || []).length) },
      { label: 'Red Flags', value: String(redFlags.length) },
      { label: 'Orange Flags', value: String(orangeFlags.length) },
      { label: 'Green Flags', value: String(greenFlags.length) },
    ],
    sections: [
      { title: 'Contract Snapshot', content: snapshotContent },
      ...(riskCardsContent ? [{ title: 'Contract Risk Cards', content: riskCardsContent }] : []),
      ...(flagsContent ? [{ title: 'Flag Summary', content: flagsContent }] : []),
    ],
  }

  return generateReportHtml(config)
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
