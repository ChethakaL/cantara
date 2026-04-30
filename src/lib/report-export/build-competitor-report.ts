import type { CompetitorAnalysisReport } from '@/lib/competitor-analysis/types'
import {
  generateReportHtml,
  buildHtmlTable,
  buildBulletList,
  type ReportConfig,
} from './generate-report-html'

export function buildCompetitorReportHtml(report: CompetitorAnalysisReport): string {
  // Competitor comparison table (top 5)
  const topCompetitors = report.competitors.slice(0, 5)
  const compRows = topCompetitors.map(c => [
    c.name,
    `${c.distanceMiles.toFixed(1)} mi`,
    c.rating?.toFixed(1) ?? 'N/A',
    String(c.reviewCount ?? 'N/A'),
    c.similarityLevel.charAt(0).toUpperCase() + c.similarityLevel.slice(1),
    c.services.slice(0, 3).join(', ') || 'N/A',
  ])
  const compTable = buildHtmlTable(
    ['Competitor', 'Distance', 'Rating', 'Reviews', 'Similarity', 'Services'],
    compRows,
  )

  // Service offering comparison
  const serviceOrder = ['Dog Boarding', 'Dog Daycare', 'Dog Grooming', 'Dog Training', 'Cat Boarding']
  const serviceRows = serviceOrder.map(svc => {
    const svcLower = svc.toLowerCase()
    const subjectHas = report.clientProfile.services.some(s => s.toLowerCase() === svcLower)
    const compCells = topCompetitors.slice(0, 4).map(c =>
      c.services.some(s => s.toLowerCase() === svcLower) ? 'Yes' : '-'
    )
    return [svc, subjectHas ? 'Yes' : '-', ...compCells]
  })
  const serviceTable = buildHtmlTable(
    ['Service', report.businessName, ...topCompetitors.slice(0, 4).map(c => c.name.slice(0, 18))],
    serviceRows,
  )

  const config: ReportConfig = {
    title: 'Competitor Analysis Report',
    subtitle: `${report.radiusMiles}-Mile Radius Market Assessment`,
    clientName: report.businessName,
    generatedAt: report.generatedAt,
    summary: report.executiveSummary,
    kpis: [
      { label: 'Nearby Competitors', value: String(report.marketStats.discoveredCompetitors) },
      { label: 'Avg Rating', value: report.marketStats.averageCompetitorRating?.toFixed(1) ?? 'N/A' },
      { label: 'Direct Substitutes', value: String(report.marketStats.highSimilarityCount) },
      { label: 'Closest', value: report.marketStats.closestCompetitorDistanceMiles != null ? `${report.marketStats.closestCompetitorDistanceMiles.toFixed(1)} mi` : 'N/A' },
    ],
    sections: [
      { title: 'Competitor Overview', content: compTable },
      { title: 'Service Offering Comparison', content: serviceTable },
      {
        title: 'Key Takeaways',
        content: buildBulletList(report.keyTakeaways || []),
      },
      {
        title: 'Recommendations',
        content: buildBulletList(report.recommendations || []),
      },
    ],
  }

  return generateReportHtml(config)
}
