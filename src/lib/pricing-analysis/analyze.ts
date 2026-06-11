import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from "@/lib/secure-settings"
import type { CompetitorPricingInput, PricingAnalysisReport } from './types'
import { normalizePricingReport } from './normalize-report'
import { getAIClient, requireAIClient, resolveModel, usesBedrock } from "@/lib/ai-client"

function extractText(result: Anthropic.Messages.Message): string {
  return result.content
    .filter((block) => block.type === 'text')
    .map((block) => ('text' in block ? block.text : ''))
    .join('')
    .trim()
}

export async function analyzePricing(args: {
  businessName: string
  sellerWebsiteUrl?: string | null
  sellerPricingResearch: any
  competitors: CompetitorPricingInput[]
  competitorData: any
}): Promise<PricingAnalysisReport> {
    const client = await requireAIClient()

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

  const response = await client.messages.create({
    model: resolveModel('claude-sonnet-4-20250514'),
    max_tokens: 9000,
    temperature: 0,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: `Pricing research context:\n${JSON.stringify(context, null, 2)}\n\nReturn the detailed competitor pricing analysis JSON.` }],
      },
    ],
  })

  const rawText = extractText(response)
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = JSON.parse(cleaned) as unknown
  const normalized = normalizePricingReport(parsed)
  if (!normalized) {
    throw new Error('AI returned an invalid pricing report. Please run the analysis again.')
  }
  return normalized
}
