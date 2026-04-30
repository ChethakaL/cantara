import type { LitigationSearchResult } from '@/lib/litigation-search/search'
import {
  generateReportHtml,
  buildHtmlTable,
  buildBulletList,
  type ReportConfig,
} from './generate-report-html'

export function buildLitigationReportHtml(
  result: LitigationSearchResult,
  clientName: string,
): string {
  const riskLabels: Record<string, string> = {
    high: 'High Risk',
    medium: 'Medium Risk',
    low: 'Low Risk',
    clear: 'Clear',
  }

  // KPIs
  const kpis = [
    { label: 'Risk Level', value: riskLabels[result.riskLevel] || result.riskLevel },
    { label: 'Total Findings', value: String(result.findings.length) },
    { label: 'Searches Performed', value: String(result.searchesPerformed.length) },
  ]

  // Summary section
  const summaryContent = `<p>${result.summary}</p>`

  // Findings table
  const findingsContent = result.findings.length > 0
    ? buildHtmlTable(
        ['Type', 'Title', 'Description', 'Severity', 'Source', 'Date'],
        result.findings.map(f => [
          f.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          f.title,
          f.description,
          f.severity.charAt(0).toUpperCase() + f.severity.slice(1),
          f.source || '\u2014',
          f.date || '\u2014',
        ]),
      )
    : '<p>No findings were identified in the search.</p>'

  // Searches performed
  const searchesContent = result.searchesPerformed.length > 0
    ? buildBulletList(result.searchesPerformed)
    : '<p>No searches recorded.</p>'

  const config: ReportConfig = {
    title: 'Litigation & Lien Search Report',
    subtitle: 'Public Records Analysis',
    clientName,
    generatedAt: result.generatedAt,
    summary: result.summary,
    kpis,
    sections: [
      { title: 'Findings', content: findingsContent },
      { title: 'Searches Performed', content: searchesContent },
    ],
  }

  return generateReportHtml(config)
}
