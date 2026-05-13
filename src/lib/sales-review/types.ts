export interface SalesProcessReviewResult {
  summary: string
  keyFindings: string[]
  benchmarkComparisons: Array<{
    metric: string
    actual: string
    benchmark: string
    status: 'above' | 'below' | 'at'
  }>
  recommendations: string[]
  generatedAt: string
}
