import type { ContractReport } from '@/lib/contract-analysis/types'
import {
  generateReportHtml,
  buildHtmlTable,
  type ReportConfig,
} from './generate-report-html'

function isVisibleFlag(flag: { reviewStatus?: string }): boolean {
  return flag.reviewStatus !== 'not_applicable'
}

function getVisibleFlags<T extends { reviewStatus?: string }>(flags: T[]): T[] {
  return flags.filter(isVisibleFlag)
}

/** Summary report: snapshot table + flag summary with review statuses (1-2 pages) */
export function buildContractSummaryHtml(report: ContractReport, clientName: string): string {
  const redFlags = getVisibleFlags(report.redFlags || [])
  const orangeFlags = getVisibleFlags(report.orangeFlags || [])
  const greenFlags = getVisibleFlags(report.greenFlags || [])

  const snapshotContent = `
    <div class="contract-snapshot">
      ${(report.snapshotTable || []).map((row, index) => `
        <div class="contract-snapshot-row">
          <div class="contract-snapshot-index">${index + 1}</div>
          <div class="contract-snapshot-main">
            <div class="contract-snapshot-field">${escapeHtml(row.field)}</div>
            <div class="contract-snapshot-finding">${escapeHtml(row.finding)}</div>
          </div>
          <div class="contract-snapshot-source">${escapeHtml(row.sourceSection || 'Source not specified')}</div>
        </div>
      `).join('\n')}
    </div>`

  // Flag summary with review statuses
  const buildFlagWithStatus = (flags: Array<{ issue: string; whyItMatters: string; reviewStatus?: string; reviewNotes?: string }>, color: 'red' | 'orange' | 'green') => {
    if (!flags.length) return ''
    return flags.map(f => {
      const statusLabel = f.reviewStatus === 'relevant' ? ' [Reviewed]'
        : f.reviewStatus === 'questionable' ? ' [Questionable]'
        : ''
      const notesHtml = f.reviewStatus === 'questionable' && f.reviewNotes
        ? `<div class="flag-detail" style="font-style:italic;margin-top:4px;">Note: ${escapeHtml(f.reviewNotes)}</div>`
        : ''
      return `
        <div class="flag-item ${color} contract-flag">
          <div class="flag-title">${riskDot(color)}${escapeHtml(f.issue)}${statusLabel}</div>
          <div class="flag-detail">${escapeHtml(f.whyItMatters)}</div>
          ${notesHtml}
        </div>`
    }).join('\n')
  }

  const flagsContent = [
    redFlags.length ? `<p style="font-weight:700;margin-top:12px;color:#991B1B;">Red Flags (${redFlags.length})</p>` + buildFlagWithStatus(redFlags, 'red') : '',
    orangeFlags.length ? `<p style="font-weight:700;margin-top:12px;color:#92400E;">Orange Flags (${orangeFlags.length})</p>` + buildFlagWithStatus(orangeFlags, 'orange') : '',
    greenFlags.length ? `<p style="font-weight:700;margin-top:12px;color:#166534;">Green Flags (${greenFlags.length})</p>` + buildFlagWithStatus(greenFlags, 'green') : '',
  ].join('')

  const config: ReportConfig = {
    title: 'Material Contracts Report',
    subtitle: 'Summary & Risk Assessment',
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
      ...(flagsContent ? [{ title: 'Flag Summary', content: flagsContent }] : []),
    ],
  }

  return generateReportHtml(config)
}

function riskDot(color: 'red' | 'orange' | 'green'): string {
  const dotColor = color === 'red' ? '#dc2626' : color === 'orange' ? '#d97706' : '#16a34a'
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${dotColor};margin-right:8px;vertical-align:1px;"></span>`
}

/** Addendum: full per-contract risk cards with all details (multi-page) */
export function buildContractAddendumHtml(report: ContractReport, clientName: string): string {
  const riskCardSections = (report.contractRiskCards || []).map(card => {
    const allFlags = [
      ...getVisibleFlags(card.redFlags).map(f => ({ ...f, color: 'red' as const })),
      ...getVisibleFlags(card.orangeFlags).map(f => ({ ...f, color: 'orange' as const })),
      ...getVisibleFlags(card.greenFlags).map(f => ({ ...f, color: 'green' as const })),
    ]

    const flagHtml = allFlags.map(f => {
      const statusLabel = f.reviewStatus === 'relevant' ? ' [Reviewed]'
        : f.reviewStatus === 'questionable' ? ' [Questionable]'
        : ''
      const notesHtml = f.reviewStatus === 'questionable' && f.reviewNotes
        ? `<div class="flag-detail" style="font-style:italic;margin-top:4px;">Note: ${escapeHtml(f.reviewNotes)}</div>`
        : ''
      return `<div class="flag-item ${f.color}">
        <div class="flag-title">${escapeHtml(f.issue)}${statusLabel}</div>
        <div class="flag-detail">${escapeHtml(f.whyItMatters)}</div>
        ${f.suggestedAction ? `<div class="flag-detail" style="margin-top:4px;"><strong>Action:</strong> ${escapeHtml(f.suggestedAction)}</div>` : ''}
        ${f.sourceSection ? `<div class="flag-detail" style="font-size:11px;color:#64748b;margin-top:2px;">Source: ${escapeHtml(f.sourceSection)}</div>` : ''}
        ${notesHtml}
      </div>`
    }).join('')

    return {
      title: card.contractName,
      content: `<p style="margin-bottom:4px;"><strong>Risk Tier:</strong> ${escapeHtml(card.riskTier)}</p>
        <p style="font-size:12px;color:#475569;margin-bottom:12px;">${escapeHtml(card.recommendedAction)}</p>
        ${flagHtml}`,
    }
  })

  // Detailed findings addendum
  const findingsSections = (report.detailedFindings || []).map(f => ({
    title: `${f.id} — ${f.title}`,
    content: `<div style="font-size:13px;line-height:1.7;color:#475569;">${f.content.replace(/\n/g, '<br/>')}</div>`,
  }))

  // Document inventory
  const docInventory = (report.documentInventory || []).length > 0
    ? [{
        title: 'Document Inventory',
        content: buildHtmlTable(
          ['Document', 'Type', 'Date', 'Status'],
          report.documentInventory.map(d => [d.document, d.documentType || '', d.date || '', d.status || '']),
        ),
      }]
    : []

  const config: ReportConfig = {
    title: 'Material Contracts — Risk Cards & Findings',
    subtitle: 'Addendum',
    clientName,
    generatedAt: report.generatedAt,
    sections: [...riskCardSections, ...findingsSections, ...docInventory],
  }

  return generateReportHtml(config)
}

/** Legacy: alias for summary (backwards compat) */
export function buildContractReportHtml(report: ContractReport, clientName: string): string {
  return buildContractSummaryHtml(report, clientName)
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
