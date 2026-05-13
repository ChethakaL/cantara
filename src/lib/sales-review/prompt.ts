import type { SalesProcessReviewResult } from './types'

export function buildSalesProcessReviewSystemPrompt(args: {
  businessName: string
  todayIso: string
}) {
  return `You are an expert sales operations and revenue consultant for pet resorts, dog daycare, boarding, grooming, and veterinary-adjacent hospitality businesses in North America.

You receive the full text of a sales call transcript, discovery call notes, or similar document about how the business sells and converts leads.

Business context name: ${args.businessName}
Today's date (for relative language only): ${args.todayIso}

Your job is to evaluate the **sales and conversion process** described in the transcript: discovery → proposal/quotes → booking or enrollment → onboarding — compared to **typical pet resort industry benchmarks** (ranges are illustrative; state assumptions briefly when the transcript lacks numbers).

Respond with **ONLY** valid JSON matching this TypeScript shape (no markdown fences, no commentary):

{
  "summary": string,
  "keyFindings": string[],
  "benchmarkComparisons": Array<{
    "metric": string,
    "actual": string,
    "benchmark": string,
    "status": "above" | "below" | "at"
  }>,
  "recommendations": string[],
  "generatedAt": string
}

Rules:
- "generatedAt" must be ISO 8601 UTC for the analysis moment (use ${args.todayIso} as the calendar date if you cannot access real time).
- Use at least 3 benchmarkComparisons when the transcript allows (e.g. lead response time, tour/show rate, quote-to-book %). If metrics are missing, set "actual" to what can be inferred or "Not stated in transcript" and status "at" only when comparing qualitative fit.
- keyFindings: 4–8 concise bullets grounded in the transcript.
- recommendations: 5–10 specific, actionable items for the operator.
- summary: 2–4 short paragraphs in plain language.

Benchmark examples (adjust to transcript; do not invent precise percentages without evidence):
- First response to inbound lead: industry often targets under 15–30 minutes for best-in-class; same-day acceptable for smaller operators.
- Tour / facility visit booking rate from qualified leads: varies widely; note when process gaps appear.
- Quote/proposal follow-up discipline: multiple touches within 48–72 hours common for high performers.

If the transcript is empty or not sales-related, still return valid JSON with summary explaining the issue, empty or minimal arrays, generatedAt set, and recommendations suggesting uploading a clearer sales/discovery transcript.`
}

export function normalizeSalesProcessResult(raw: unknown): SalesProcessReviewResult {
  const fallback = (msg: string): SalesProcessReviewResult => ({
    summary: msg,
    keyFindings: [],
    benchmarkComparisons: [],
    recommendations: ['Upload a sales or discovery call transcript with more detail and run the analysis again.'],
    generatedAt: new Date().toISOString(),
  })

  if (!raw || typeof raw !== 'object') return fallback('Analysis returned an unexpected format.')

  const o = raw as Record<string, unknown>
  const summary = typeof o.summary === 'string' ? o.summary : ''
  const keyFindings = Array.isArray(o.keyFindings)
    ? o.keyFindings.filter((x): x is string => typeof x === 'string')
    : []
  const recommendations = Array.isArray(o.recommendations)
    ? o.recommendations.filter((x): x is string => typeof x === 'string')
    : []

  const benchmarkComparisons = Array.isArray(o.benchmarkComparisons)
    ? o.benchmarkComparisons
        .map((row): SalesProcessReviewResult['benchmarkComparisons'][0] | null => {
          if (!row || typeof row !== 'object') return null
          const r = row as Record<string, unknown>
          const metric = typeof r.metric === 'string' ? r.metric : ''
          const actual = typeof r.actual === 'string' ? r.actual : ''
          const benchmark = typeof r.benchmark === 'string' ? r.benchmark : ''
          const status = r.status === 'above' || r.status === 'below' || r.status === 'at' ? r.status : 'at'
          if (!metric && !actual) return null
          return { metric, actual, benchmark, status }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    : []

  const generatedAt =
    typeof o.generatedAt === 'string' && o.generatedAt.trim()
      ? o.generatedAt.trim()
      : new Date().toISOString()

  return {
    summary: summary || 'No summary returned.',
    keyFindings,
    benchmarkComparisons,
    recommendations,
    generatedAt,
  }
}
