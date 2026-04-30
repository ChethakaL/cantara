import type { DigitalPresenceReport } from '@/lib/digital-presence/types'
import {
  generateReportHtml,
  buildHtmlTable,
  buildBulletList,
  type ReportConfig,
} from './generate-report-html'

export function buildDigitalPresenceReportHtml(report: DigitalPresenceReport): string {
  // Channel scores table
  const channelRows = report.channels.map(ch => [
    ch.channelLabel,
    `${ch.score}/5`,
    ch.trafficLight === 'green' ? 'Good' : ch.trafficLight === 'amber' ? 'Fair' : 'Poor',
    ch.summary.slice(0, 120) + (ch.summary.length > 120 ? '...' : ''),
  ])
  const channelTable = buildHtmlTable(
    ['Channel', 'Score', 'Status', 'Summary'],
    channelRows,
  )

  // Flags summary
  const allFlags = report.channels.flatMap(ch => ch.flags)
  const criticalFlags = allFlags.filter(f => f.severity === 'critical').map(f => f.message)
  const warningFlags = allFlags.filter(f => f.severity === 'warning').map(f => f.message)
  const positiveFlags = allFlags.filter(f => f.severity === 'positive').map(f => f.message)

  let flagsContent = ''
  if (criticalFlags.length) flagsContent += `<p style="font-weight:700;color:#b91c1c;">Critical Issues</p>` + buildBulletList(criticalFlags)
  if (warningFlags.length) flagsContent += `<p style="font-weight:700;color:#92400e;">Warnings</p>` + buildBulletList(warningFlags)
  if (positiveFlags.length) flagsContent += `<p style="font-weight:700;color:#166534;">Positive Signals</p>` + buildBulletList(positiveFlags)

  // Asset inventory
  const activeAssets = report.digitalAssetInventory.filter(a => a.status === 'active')
  const assetRows = activeAssets.map(a => [
    a.assetType,
    a.channelType.replace(/_/g, ' '),
    a.url.slice(0, 50) + (a.url.length > 50 ? '...' : ''),
    a.score ? `${a.score}/5` : '-',
  ])
  const assetTable = assetRows.length
    ? buildHtmlTable(['Asset', 'Channel', 'URL', 'Score'], assetRows)
    : '<p>No active digital assets found.</p>'

  const greenCount = report.channels.filter(ch => ch.trafficLight === 'green').length
  const redCount = report.channels.filter(ch => ch.trafficLight === 'red').length

  const config: ReportConfig = {
    title: 'Digital Presence Report',
    subtitle: 'Channel Assessment & M&A Readiness',
    clientName: report.businessName,
    generatedAt: report.generatedAt,
    summary: report.executiveSummary,
    kpis: [
      { label: 'Overall Score', value: `${report.overallScore}/5` },
      { label: 'Channels Good', value: String(greenCount) },
      { label: 'Channels At Risk', value: String(redCount) },
      { label: 'Active Assets', value: String(activeAssets.length) },
    ],
    sections: [
      { title: 'Channel Scores', content: channelTable },
      ...(flagsContent ? [{ title: 'Key Flags', content: flagsContent }] : []),
      { title: 'Digital Asset Inventory', content: assetTable },
      ...(report.maReadinessNotes ? [{ title: 'M&A Readiness Notes', content: `<p>${escapeHtml(report.maReadinessNotes)}</p>` }] : []),
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
