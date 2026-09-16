import type { CompetitorPricingInput, PriceMatrixRow, PricingAnalysisReport, PricingSummaryRow } from './types'
import { normalizePricingReport } from './normalize-report'
import { createAgentMessage } from '@/lib/llm-completion'

type SellerDaycarePrice = {
  service: 'Daycare - Full Day' | 'Daycare - Half Day'
  basis: 'Full Day' | 'Half Day'
  rawPrice: string
  normalizedPrice: string
  normalizedNumeric: number
}

function formatDollar(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`
}

function extractSellerDaycarePrices(manualPricingText?: string | null): SellerDaycarePrice[] {
  if (!manualPricingText?.trim()) return []

  const found = new Map<SellerDaycarePrice['basis'], SellerDaycarePrice>()
  const lines = manualPricingText
    .split(/\r?\n|;/)
    .map(line => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    const lower = line.toLowerCase()
    if (!/(daycare|day care|day camp)/.test(lower)) continue

    const priceMatch = line.match(/\$\s*(\d+(?:\.\d{1,2})?)/)
    if (!priceMatch) continue

    const price = Number(priceMatch[1])
    if (!Number.isFinite(price)) continue

    if (/(full\s*-?\s*day|full\s+day)/.test(lower)) {
      found.set('Full Day', {
        service: 'Daycare - Full Day',
        basis: 'Full Day',
        rawPrice: `${formatDollar(price)}/day`,
        normalizedPrice: formatDollar(price),
        normalizedNumeric: price,
      })
    }

    if (/(half\s*-?\s*day|half\s+day)/.test(lower)) {
      found.set('Half Day', {
        service: 'Daycare - Half Day',
        basis: 'Half Day',
        rawPrice: `${formatDollar(price)}/half day`,
        normalizedPrice: formatDollar(price * 2),
        normalizedNumeric: price * 2,
      })
    }
  }

  return Array.from(found.values())
}

function findDaycareRowIndex<T extends { service: string; basis?: string }>(
  rows: T[],
  daycarePrice: SellerDaycarePrice,
): number {
  const service = daycarePrice.service.toLowerCase()
  const basis = daycarePrice.basis.toLowerCase()
  return rows.findIndex(row => {
    const rowService = String(row.service ?? '').toLowerCase()
    const rowBasis = String(row.basis ?? '').toLowerCase()
    return (
      rowService === service ||
      (/daycare|day care/.test(rowService) &&
        (rowService.includes(basis) || rowBasis.includes(basis)))
    )
  })
}

function applySellerManualPricingEvidence(
  report: PricingAnalysisReport,
  manualPricingText?: string | null,
): PricingAnalysisReport {
  const daycarePrices = extractSellerDaycarePrices(manualPricingText)
  if (!daycarePrices.length) return report

  const priceMatrix = [...(report.priceMatrix ?? [])]
  const pricingSummary = [...(report.pricingSummary ?? [])]
  const competitorTemplate = priceMatrix[0]?.competitors ?? []

  for (const daycarePrice of daycarePrices) {
    const matrixIndex = findDaycareRowIndex(priceMatrix, daycarePrice)
    const nextMatrixRow: PriceMatrixRow =
      matrixIndex >= 0
        ? {
            ...priceMatrix[matrixIndex],
            service: daycarePrice.service,
            basis: daycarePrice.basis,
            sellerPrice: daycarePrice.rawPrice,
            sellerNormalized: daycarePrice.normalizedPrice,
            sellerNormalizedNumeric: daycarePrice.normalizedNumeric,
          }
        : {
            service: daycarePrice.service,
            basis: daycarePrice.basis,
            sellerPrice: daycarePrice.rawPrice,
            sellerNormalized: daycarePrice.normalizedPrice,
            sellerNormalizedNumeric: daycarePrice.normalizedNumeric,
            competitors: competitorTemplate.map(competitor => ({
              ...competitor,
              listedPrice: '',
              normalized: '',
              normalizedNumeric: null,
              normalizationNote: '',
            })),
          }

    if (matrixIndex >= 0) priceMatrix[matrixIndex] = nextMatrixRow
    else priceMatrix.push(nextMatrixRow)

    const summaryIndex = findDaycareRowIndex(pricingSummary, daycarePrice)
    const summaryPrice =
      daycarePrice.basis === 'Half Day'
        ? `${daycarePrice.normalizedPrice}/day normalized (${daycarePrice.rawPrice})`
        : daycarePrice.normalizedPrice
    const nextSummaryRow: PricingSummaryRow =
      summaryIndex >= 0
        ? {
            ...pricingSummary[summaryIndex],
            service: daycarePrice.service,
            sellerPrice: summaryPrice,
            sellerPriceNumeric: daycarePrice.normalizedNumeric,
          }
        : {
            service: daycarePrice.service,
            sellerPrice: summaryPrice,
            sellerPriceNumeric: daycarePrice.normalizedNumeric,
            competitorAvg: '',
            competitorAvgNumeric: null,
            variance: '',
            variancePercent: null,
            status: 'unknown',
            estAnnualUplift: '',
          }

    if (summaryIndex >= 0) pricingSummary[summaryIndex] = nextSummaryRow
    else pricingSummary.push(nextSummaryRow)
  }

  return { ...report, priceMatrix, pricingSummary }
}

export async function analyzePricing(args: {
  businessName: string
  sellerWebsiteUrl?: string | null
  sellerPricingResearch: any
  competitors: CompetitorPricingInput[]
  competitorData: any
}): Promise<PricingAnalysisReport> {
  const systemPrompt = `You are the Competitive Pricing Analysis Agent for Cantara, an M&A advisory platform for pet businesses.

You receive seller and competitor pricing data (website research and optional admin-provided text). Produce a clean two-table comparison for a pet resort M&A advisory.

For each service found (Boarding, Daycare Full Day, Daycare Half Day, Grooming by size, Training, Cat Boarding, Packages, and any other services with evidence):
- Extract the seller's listed price and basis
- Extract each competitor's listed price and basis
- Normalize ALL prices to a comparable daily rate using these rules:
  - Full day -> as-is
  - Half day -> multiply by 2
  - 4-hour block -> multiply by 3 (assumes 12hr day)
  - Hourly -> multiply by 8
  - Per night (boarding) -> as-is
  - Package (e.g. 10-day, 20-day) -> divide by the number of days
  - If duration is unknown -> normalized value is null, display "--"
- Use the phrase "average across competitors" instead of "market average" everywhere.
- Calculate competitor average from normalized daily rates (exclude null values)
- Calculate variance: ((seller normalized - competitor avg) / competitor avg) * 100
- Status thresholds: >10% below avg = "underpriced", within +/-10% = "at-market", >15% above = "premium", insufficient data = "unknown"
- Estimate annual uplift if seller priced to the average across competitors (use reasonable volume assumptions and state them)
- Generate flags for significant underpricing (>20% = critical, 10-20% = warning, competitive/premium = positive, general observations = informational)
- Write a 3-4 sentence executive summary
- Provide 3-5 actionable recommendations with specific price change suggestions where evidence supports it
- If seller pricing evidence is present in sellerPricingResearch.priceEvidence or pricePoints, do not say seller pricing is unavailable
- If admin-provided manualPricingText exists for the seller or a competitor, treat it as high-priority pricing evidence. Parse services, prices, and durations from that text.
- NEVER concatenate a price range into one number (wrong: "$22 to $32" → 2232 or "$48-$55" → 4855). For ranges, set listedPrice as "$22–$32" and normalizedNumeric to the midpoint (e.g. 27).
- NEVER glue a package total with its day count (wrong: "$390 / 10 days" → 39010). listedPrice stays "$390/10-day"; normalizedNumeric = total/days.

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "generatedAt": "<ISO timestamp>",
  "businessName": "<business name>",
  "radiusMiles": <number>,
  "sellerWebsiteUrl": "<url|null>",
  "competitors": [{"name":"<name>","websiteUrl":"<url>"}],
  "competitorsAnalyzed": <number>,
  "priceMatrix": [
    {
      "service": "<service name e.g. Daycare - Full Day>",
      "basis": "<Full Day|Half Day|Per Night|10-Day Package|etc.>",
      "sellerPrice": "<raw listed price e.g. $62/day>",
      "sellerNormalized": "<normalized daily rate e.g. $62>",
      "sellerNormalizedNumeric": <number|null>,
      "competitors": [
        {
          "name": "<competitor name>",
          "listedPrice": "<raw listed price e.g. $25/half day>",
          "normalized": "<normalized daily rate e.g. $50>",
          "normalizedNumeric": <number|null>,
          "normalizationNote": "<e.g. Half day x2, or As-is, or Package / 10 days>"
        }
      ]
    }
  ],
  "pricingSummary": [
    {
      "service": "<service name>",
      "sellerPrice": "<seller normalized daily rate>",
      "sellerPriceNumeric": <number|null>,
      "competitorAvg": "<average across competitors normalized daily rate>",
      "competitorAvgNumeric": <number|null>,
      "variance": "<e.g. -11.4%>",
      "variancePercent": <number|null>,
      "status": "<underpriced|at-market|premium|unknown>",
      "estAnnualUplift": "<e.g. $12,500/yr (assumes 250 dogs/yr)>"
    }
  ],
  "flags": [
    {
      "id": "<unique id>",
      "severity": "<critical|warning|positive|informational>",
      "title": "<short title>",
      "description": "<description>"
    }
  ],
  "executiveSummary": "<3-4 sentence summary>",
  "totalEstimatedUplift": "<total uplift string>",
  "recommendations": ["<rec1>", "<rec2>", "<rec3>"]
}`

  const context = {
    businessName: args.businessName,
    sellerWebsiteUrl: args.sellerWebsiteUrl,
    sellerPricingResearch: args.sellerPricingResearch,
    competitors: args.competitors,
    competitorData: args.competitorData,
  }

  const rawText = await createAgentMessage({
    system: systemPrompt,
    content: `Pricing research context:\n${JSON.stringify(context, null, 2)}\n\nReturn the detailed competitor pricing analysis JSON.`,
    maxTokens: 9000,
    temperature: 0,
  })

  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(cleaned) as unknown
  const normalized = normalizePricingReport(parsed)
  if (!normalized) {
    throw new Error('AI returned an invalid pricing report. Please run the analysis again.')
  }
  return applySellerManualPricingEvidence(
    normalized,
    args.sellerPricingResearch?.manualPricingText,
  )
}

/** Re-score narrative/summary from advisor-edited matrix + manual evidence (no website re-scrape). */
export async function reanalyzePricingFromEdits(
  existingReport: PricingAnalysisReport,
  options?: {
    sellerManualPricingText?: string | null
    competitorManualEvidence?: Array<{ name: string; manualPricingText?: string | null }>
  },
): Promise<PricingAnalysisReport> {
  const systemPrompt = `You are the Competitive Pricing Analysis Agent for Cantara (pet business M&A).

The user message includes:
1) AUTHORITATIVE advisor-edited priceMatrix (table cells)
2) OPTIONAL manualPricingEvidence text the advisor pasted/edited (seller + per competitor)

Rules:
- If manualPricingEvidence is present for a seller/competitor, treat that text as HIGH-PRIORITY ground truth and UPDATE the matching priceMatrix cells to match it (parse services and prices from the text).
- Otherwise treat priceMatrix listed prices as ground truth.
- Fix any glued range bugs (e.g. 2232 must become midpoint of 22–32; 39010 is a $390 10-day package not $39010).
- For explicit ranges like "$48 - $11" or "$48–$55": listedPrice keeps the range string; normalizedNumeric = midpoint. NEVER concatenate into 4811 / 4855.
- Recompute sellerNormalized / normalized / *Numeric, pricingSummary, flags, executiveSummary, recommendations, totalEstimatedUplift.
- generatedAt = new ISO timestamp.

Return ONLY valid JSON with EXACTLY these top-level keys (no markdown):
{
  "generatedAt": "<ISO>",
  "businessName": "<string>",
  "radiusMiles": <number>,
  "sellerWebsiteUrl": "<string|null>",
  "competitors": [{"name":"<name>","websiteUrl":"<url>"}],
  "competitorsAnalyzed": <number>,
  "priceMatrix": [ ... same shape, updated from evidence/edits ... ],
  "pricingSummary": [ ... ],
  "flags": [ ... ],
  "executiveSummary": "<string>",
  "totalEstimatedUplift": "<string>",
  "recommendations": ["<string>", ...]
}

Normalization rules:
- Full day -> as-is; Half day -> x2; Hourly -> x8; Package N-day -> total/N
- NEVER concatenate range endpoints into one number; use midpoint for normalizedNumeric
- NEVER glue package total with day count into one number`

  const rawText = await createAgentMessage({
    system: systemPrompt,
    content: `AUTHORITATIVE ADVISOR-EDITED REPORT:\n${JSON.stringify({
      businessName: existingReport.businessName,
      radiusMiles: existingReport.radiusMiles,
      sellerWebsiteUrl: existingReport.sellerWebsiteUrl,
      competitors: existingReport.competitors,
      competitorsAnalyzed: existingReport.competitorsAnalyzed,
      priceMatrix: existingReport.priceMatrix,
      pricingSummary: existingReport.pricingSummary,
      flags: existingReport.flags,
      executiveSummary: existingReport.executiveSummary,
      totalEstimatedUplift: existingReport.totalEstimatedUplift,
      recommendations: existingReport.recommendations,
    }, null, 2)}\n\nMANUAL PRICING EVIDENCE (high priority when present):\n${JSON.stringify({
      sellerManualPricingText: options?.sellerManualPricingText ?? '',
      competitors: (options?.competitorManualEvidence ?? []).map((c) => ({
        name: c.name,
        manualPricingText: c.manualPricingText ?? '',
      })),
    }, null, 2)}\n\nReturn the refreshed pricing analysis JSON.`,
    maxTokens: 9000,
    temperature: 0,
  })

  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  let parsed: unknown
  try {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned)
  } catch {
    throw new Error('AI returned unparseable pricing JSON on reanalyze. Please retry.')
  }

  const normalized = normalizePricingReport(parsed)
  if (!normalized) {
    throw new Error('AI returned an invalid pricing report on reanalyze. Please retry.')
  }

  // Keep competitor roster from edits if AI drops them; prefer AI-fixed matrix.
  return {
    ...normalized,
    competitors: normalized.competitors?.length ? normalized.competitors : existingReport.competitors,
    competitorsAnalyzed: normalized.competitorsAnalyzed || existingReport.competitorsAnalyzed,
    radiusMiles: normalized.radiusMiles || existingReport.radiusMiles,
    sellerWebsiteUrl: normalized.sellerWebsiteUrl ?? existingReport.sellerWebsiteUrl,
    businessName: normalized.businessName || existingReport.businessName,
    generatedAt: new Date().toISOString(),
  }
}
