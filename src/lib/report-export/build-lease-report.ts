import type { LeaseReport } from '@/lib/lease-analysis/types'
import { getVisibleFlags } from '@/lib/lease-analysis/report-utils'
import {
  generateReportHtml,
  buildHtmlTable,
  buildFlagListHtml,
  type ReportConfig,
} from './generate-report-html'

export function buildLeaseReportHtml(report: LeaseReport, clientName: string): string {
  const redFlags = getVisibleFlags(report.redFlags || [])
  const orangeFlags = getVisibleFlags(report.orangeFlags || [])
  const greenFlags = getVisibleFlags(report.greenFlags || [])

  // Snapshot table section
  const snapshotRows = (report.snapshotTable || []).map(row => [
    row.field,
    row.finding,
    row.sourceSection,
  ])
  const snapshotContent = buildHtmlTable(
    ['Field', 'Finding', 'Source'],
    snapshotRows,
  )

  // Detailed findings section
  const findingsContent = (report.detailedFindings || [])
    .slice(0, 8)
    .map(f => `<p><strong>${f.id} ${f.title}</strong></p><p>${f.content.slice(0, 300)}${f.content.length > 300 ? '...' : ''}</p>`)
    .join('')

  // Flag section
  const flagsContent = [
    redFlags.length ? `<p style="font-weight:700;margin-top:8px;">Red Flags</p>` + buildFlagListHtml(redFlags, 'red') : '',
    orangeFlags.length ? `<p style="font-weight:700;margin-top:8px;">Yellow Flags</p>` + buildFlagListHtml(orangeFlags, 'orange') : '',
    greenFlags.length ? `<p style="font-weight:700;margin-top:8px;">Green Flags</p>` + buildFlagListHtml(greenFlags, 'green') : '',
  ].join('')

  const config: ReportConfig = {
    title: 'Lease Analysis Report',
    subtitle: 'Deal Killer & Risk Assessment',
    clientName,
    generatedAt: report.generatedAt,
    flags: {
      red: redFlags.length,
      orange: orangeFlags.length,
      green: greenFlags.length,
    },
    kpis: [
      { label: 'Red Flags', value: String(redFlags.length) },
      { label: 'Yellow Flags', value: String(orangeFlags.length) },
      { label: 'Green Flags', value: String(greenFlags.length) },
      { label: 'Key Terms', value: String(snapshotRows.length) },
    ],
    sections: [
      { title: 'Lease Snapshot', content: snapshotContent },
      ...(findingsContent ? [{ title: 'Key Findings', content: findingsContent }] : []),
      ...(flagsContent ? [{ title: 'Flag Analysis', content: flagsContent }] : []),
    ],
  }

  return generateReportHtml(config)
}
