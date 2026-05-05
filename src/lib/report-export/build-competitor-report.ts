import type { CompetitorAnalysisReport } from '@/lib/competitor-analysis/types'
import {
  generateReportHtml,
  buildHtmlTable,
  buildBulletList,
  type ReportConfig,
} from './generate-report-html'

function buildMapSection(report: CompetitorAnalysisReport): string {
  const points = report.discoveredCompetitors
    .slice(0, 20)
    .map((c, i) => `${c.location.lat},${c.location.lng},${i + 1}`)
    .join(';')

  const params = new URLSearchParams({
    center: `${report.searchCenter.lat},${report.searchCenter.lng}`,
    subject: `${report.clientProfile.location.lat},${report.clientProfile.location.lng}`,
    radius: String(report.radiusMiles),
    points,
  })

  const mapUrl = `/api/competitor-analysis/static-map?${params.toString()}`

  const legendRows = report.discoveredCompetitors
    .slice(0, 20)
    .map((c, i) => {
      const researched = report.competitors.find(r => r.placeId === c.placeId)
      return `<tr>
        <td style="padding:4px 8px;font-weight:600;text-align:center;">${i + 1}</td>
        <td style="padding:4px 8px;">${c.name}</td>
        <td style="padding:4px 8px;">${c.distanceMiles.toFixed(1)} mi</td>
        <td style="padding:4px 8px;">${c.rating?.toFixed(1) ?? 'N/A'}</td>
        <td style="padding:4px 8px;">${researched ? researched.similarityLevel : 'Pending'}</td>
      </tr>`
    })
    .join('\n')

  return `
    <div style="text-align:center;margin-bottom:16px;">
      <img src="${mapUrl}" alt="Competitor coverage map" style="max-width:100%;border-radius:8px;border:1px solid #e2e8f0;" />
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
          <th style="padding:6px 8px;text-align:center;">#</th>
          <th style="padding:6px 8px;text-align:left;">Name</th>
          <th style="padding:6px 8px;text-align:left;">Distance</th>
          <th style="padding:6px 8px;text-align:left;">Rating</th>
          <th style="padding:6px 8px;text-align:left;">Similarity</th>
        </tr>
      </thead>
      <tbody>${legendRows}</tbody>
    </table>`
}

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
      { title: 'Market Coverage Map', content: buildMapSection(report) },
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
