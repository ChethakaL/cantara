import type { CompetitorAnalysisReport, SimilarityLevel } from '@/lib/competitor-analysis/types'

export type CompetitorEntityFactOverride = {
  rating?: number | null
  reviewCount?: number | null
  similarityScore?: number
  similarityLevel?: SimilarityLevel
}

export type CompetitorFactOverrides = {
  client?: { rating?: number | null; reviewCount?: number | null }
  competitors?: Record<string, CompetitorEntityFactOverride>
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number')
  if (!valid.length) return null
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1))
}

function clampRating(value: number | null | undefined, fallback: number | null): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.max(0, Math.min(5, Number(value.toFixed(1))))
}

function clampReviews(value: number | null | undefined, fallback: number | null): number | null {
  if (value === null) return null
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.max(0, Math.round(value))
}

export function similarityLevelFromScore(score: number): SimilarityLevel {
  if (score >= 4) return 'high'
  if (score >= 3) return 'medium'
  return 'low'
}

/** Apply advisor corrections to ratings / review counts / similarity (chart + table drivers). */
export function applyCompetitorFactOverrides(
  report: CompetitorAnalysisReport,
  overrides: CompetitorFactOverrides | null | undefined,
): CompetitorAnalysisReport {
  if (!overrides) return report

  const clientProfile = {
    ...report.clientProfile,
    rating:
      overrides.client && 'rating' in overrides.client
        ? clampRating(overrides.client.rating, report.clientProfile.rating)
        : report.clientProfile.rating,
    reviewCount:
      overrides.client && 'reviewCount' in overrides.client
        ? clampReviews(overrides.client.reviewCount, report.clientProfile.reviewCount)
        : report.clientProfile.reviewCount,
  }

  const competitors = report.competitors.map((comp) => {
    const key = comp.placeId ?? comp.name
    const row = overrides.competitors?.[key]
    if (!row) return comp
    const similarityScore =
      typeof row.similarityScore === 'number' && !Number.isNaN(row.similarityScore)
        ? Math.max(1, Math.min(5, Math.round(row.similarityScore)))
        : comp.similarityScore
    const similarityLevel =
      row.similarityLevel === 'high' || row.similarityLevel === 'medium' || row.similarityLevel === 'low'
        ? row.similarityLevel
        : typeof row.similarityScore === 'number'
          ? similarityLevelFromScore(similarityScore)
          : comp.similarityLevel
    return {
      ...comp,
      rating: 'rating' in row ? clampRating(row.rating, comp.rating) : comp.rating,
      reviewCount: 'reviewCount' in row ? clampReviews(row.reviewCount, comp.reviewCount) : comp.reviewCount,
      similarityScore,
      similarityLevel,
    }
  })

  const discoveredCompetitors = report.discoveredCompetitors.map((item) => {
    const key = item.placeId ?? item.name
    const researched = competitors.find((c) => (c.placeId ?? c.name) === key)
    if (!researched) return item
    return {
      ...item,
      rating: researched.rating,
      reviewCount: researched.reviewCount,
    }
  })

  return {
    ...report,
    clientProfile,
    competitors,
    discoveredCompetitors,
    marketStats: {
      ...report.marketStats,
      averageCompetitorRating: average(competitors.map((item) => item.rating)),
      averageCompetitorReviewCount: average(competitors.map((item) => item.reviewCount)),
      highSimilarityCount: competitors.filter((item) => item.similarityLevel === 'high').length,
    },
  }
}
