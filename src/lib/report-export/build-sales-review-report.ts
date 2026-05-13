import type { SalesProcessReviewResult } from '@/lib/sales-review/types'
import {
  buildBulletList,
  buildHtmlTable,
  generateReportHtml,
} from './generate-report-html'

export function buildSalesReviewReportHtml(
  report: SalesProcessReviewResult,
  clientName: string,
): string {
  const benchmarkRows = report.benchmarkComparisons.length
    ? report.benchmarkComparisons.map((row) => [
        row.metric,
        row.actual,
        row.benchmark,
        row.status.charAt(0).toUpperCase() + row.status.slice(1),
      ])
    : [['No benchmark comparisons returned', '-', '-', '-']]

  return generateReportHtml({
    title: 'Sales Process Review',
    subtitle: 'Lead Conversion & Booking Process Assessment',
    clientName,
    generatedAt: report.generatedAt,
    summary: report.summary,
    kpis: [
      { label: 'Key Findings', value: String(report.keyFindings.length) },
      { label: 'Benchmarks', value: String(report.benchmarkComparisons.length) },
      { label: 'Recommendations', value: String(report.recommendations.length) },
    ],
    sections: [
      { title: 'Key Findings', content: report.keyFindings.length ? buildBulletList(report.keyFindings) : '<p>No key findings returned.</p>' },
      { title: 'Benchmark Comparisons', content: buildHtmlTable(['Metric', 'Actual', 'Benchmark', 'Status'], benchmarkRows) },
      { title: 'Recommendations', content: report.recommendations.length ? buildBulletList(report.recommendations) : '<p>No recommendations returned.</p>' },
    ],
  })
}
