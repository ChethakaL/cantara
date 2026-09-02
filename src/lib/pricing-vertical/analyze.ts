import type { PricingVerticalReport } from './types'
import type { ServicePricingRow } from './types'
import type { WebsiteResearchData } from '@/lib/competitor-analysis/types'
import { safeParseModelJson } from '@/lib/pricing-vertical/parse-model-json'
import { mergeVerticalSummariesForRerun, normalizeVerticalSummary } from '@/lib/pricing-vertical/normalize-vertical-summaries'
import { enrichVerticalSummariesInReport } from '@/lib/pricing-vertical/enrich-vertical-summaries-from-grid'
import { createAgentMessage, type AgentMessageBlock } from '@/lib/llm-completion'

export async function analyzePricingByVertical(args: {
  fileName?: string
  base64?: string
  mediaType?: string
  revenueByVertical: any
  businessName: string
  websiteResearch?: WebsiteResearchData | null
  documentEvidence?: {
    sources: Array<{ documentId: string | null; fileName: string; extractedChars: number }>
    text: string
    pricingPeriods?: string[]
    structuredPricingRows?: ServicePricingRow[]
  } | null
  /** When set, model must copy these structures verbatim and only refresh summaries/flags/narrative. */
  existingReport?: PricingVerticalReport | null
}): Promise<PricingVerticalReport> {
  const isRerun = Boolean(args.existingReport)

  const fullSystemPrompt = `You are the Pricing by Vertical Analysis Agent for Cantara, an M&A advisory platform for pet businesses.

You will receive:
1. Current public website pricing evidence, when available
2. Optional seller pricing history document, when uploaded
3. Uploaded valuation / pricing / revenue document evidence from the client document library, when available
4. Revenue by vertical data from the WS2-3 derived report (JSON)

Your task:
- Primary objective: document pricing increase history over the past 24 months and comment on frequency and magnitude of increases.
- Identify current prices for every service found in website evidence and/or uploaded documents. Use pet resort services such as Boarding, Daycare, Grooming, Training, Cat Boarding, Membership, Retail, Wellness, and Other.
- Build an editable 24-month price grid with time columns (default 6-month spacing labels such as "6mo ago", "12mo ago", etc. — advisors may relabel). Current prices must be filled from website evidence where available. Historical period cells should be filled from uploaded document-library evidence or the optional uploaded file only when explicitly supported by dates/effective periods. Leave unknown cells blank.
- Do NOT emphasize or summarize revenue mix or "revenue share by vertical" in executiveSummary, overallTrend, recommendations, or flags. WS2-3 revenue JSON is for internal context only (e.g. which verticals matter operationally); never output revenue percentages or share-of-revenue commentary.
- Extract every price change event from the evidence over the past 24 months:
  - date (ISO format or best approximation)
  - service vertical (Boarding, Daycare, Grooming, Training, Cat Boarding, etc.)
  - previous price and new price
  - dollar change and percent change
  - any relevant notes
- For each service vertical:
  - Count number of price changes in the last 24 months
  - Calculate average change percentage per increase
  - Calculate total cumulative change percentage over 24 months
  - Determine the date of the last price change
  - Classify trend: "increasing" if net positive changes, "stable" if no changes, "decreasing" if net negative, "unknown" if unclear
  - Set "revenueShare" to empty string "" for every vertical (field is legacy; do not populate)
  - Write a specific recommendation (e.g. "Increase boarding rate by $3/night to $48/night effective Q3 2026")
- Generate flags (pricing-only; no revenue-share language):
  - severity "critical" for a core service vertical in the pricing grid with material current pricing but no price increase in 12+ months
  - severity "warning" for verticals below inflation (<3% annual increase)
  - severity "warning" for sudden changes above 15% in one interval
  - severity "positive" for verticals with healthy pricing momentum
  - severity "informational" for general observations
- Write a concise executive summary (3-5 sentences)
- Describe the overall pricing trend
- Provide 3-6 actionable recommendations with specific dollar amounts

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "generatedAt": "<ISO timestamp>",
  "businessName": "<business name>",
  "currentPricingSource": {
    "websiteUrl": "<url|null>",
    "confidence": "<high|medium|low>",
    "evidenceCount": <number>,
    "notes": "<brief source notes>"
  },
  "pricingPeriods": ["Current", "<6mo ago>", "<12mo ago>", "<18mo ago>", "<24mo ago>"],
  "pricingGrid": [
    {
      "id": "<stable-slug>",
      "serviceName": "<service name>",
      "vertical": "<vertical>",
      "source": "<website|document|manual|ai_inferred>",
      "sourceUrl": "<source url if any>",
      "confidence": "<high|medium|low>",
      "prices": {
        "Current": "<current price>",
        "<6mo ago>": "",
        "<12mo ago>": "",
        "<18mo ago>": "",
        "<24mo ago>": ""
      }
    }
  ],
  "priceChanges": [
    {
      "date": "<date>",
      "serviceVertical": "<vertical>",
      "previousPrice": "<price>",
      "newPrice": "<price>",
      "dollarChange": <number|null>,
      "percentChange": <number|null>,
      "notes": "<notes>"
    }
  ],
  "verticalSummaries": [
    {
      "vertical": "<vertical>",
      "currentPrice": "<price>",
      "priceChanges24Mo": <number>,
      "avgChangePercent": <number|null>,
      "totalChangePercent": <number|null>,
      "lastChangeDate": "<date>",
      "trend": "<increasing|stable|decreasing|unknown>",
      "revenueShare": "",
      "recommendation": "<recommendation>"
    }
  ],
  "executiveSummary": "<summary>",
  "overallTrend": "<trend description>",
  "recommendations": ["<rec1>", "<rec2>"],
  "flags": [
    {
      "id": "<unique id>",
      "severity": "<critical|warning|positive|informational>",
      "title": "<short title>",
      "description": "<description>"
    }
  ]
}`

  const rerunSystemPrompt = `You are the Pricing by Vertical Analysis Agent for Cantara (M&A advisory for pet businesses).

The user message includes AUTHORITATIVE advisor-edited JSON: pricingPeriods, pricingGrid, and priceChanges. Treat that JSON as the only source of truth for prices and timeline rows. You also receive website pricing evidence, document-library excerpts, and internal WS2-3 context (do not output revenue percentages or revenue-mix commentary).

Recompute from that grid + timeline + evidence:
- verticalSummaries (one per major vertical in the grid; set revenueShare to "" always)
- executiveSummary (3–5 sentences, pricing history focus only)
- overallTrend
- recommendations (3–6 actionable strings)
- flags (pricing-only; no revenue-share language)
- currentPricingSource (reflect website evidence when relevant)
- generatedAt (new ISO-8601 timestamp)
- businessName

Return ONLY valid JSON (no markdown, no code fences) with EXACTLY these top-level keys and no others:
{
  "generatedAt": "<ISO timestamp>",
  "businessName": "<string>",
  "currentPricingSource": { "websiteUrl": "<string|null>", "confidence": "<high|medium|low>", "evidenceCount": <number>, "notes": "<string>" },
  "verticalSummaries": [ ... ],
  "executiveSummary": "<string>",
  "overallTrend": "<string>",
  "recommendations": [ "<string>", ... ],
  "flags": [ { "id": "<string>", "severity": "<critical|warning|positive|informational>", "title": "<string>", "description": "<string>" } ]
}

Do NOT include pricingPeriods, pricingGrid, or priceChanges in your response.`

  const revenueContext = `INTERNAL CONTEXT — revenue by vertical (WS2-3 JSON). Use only to infer which service lines are operationally core. Do not restate percentages, revenue mix, or revenue share in any output field or narrative.\n${JSON.stringify(args.revenueByVertical, null, 2)}`
  const websiteContext = args.websiteResearch
    ? `CURRENT WEBSITE PRICING EVIDENCE:\n${JSON.stringify({
        websiteUrl: args.websiteResearch.websiteUrl,
        confidence: args.websiteResearch.confidence,
        pricePoints: args.websiteResearch.pricePoints,
        priceEvidence: args.websiteResearch.priceEvidence,
        snippets: args.websiteResearch.snippets,
        error: args.websiteResearch.error,
      }, null, 2)}`
    : 'CURRENT WEBSITE PRICING EVIDENCE:\nNo website pricing evidence available.'
  const documentEvidenceContext = args.documentEvidence?.text
    ? `UPLOADED VALUATION / PRICING DOCUMENT EVIDENCE:\nSources: ${JSON.stringify(args.documentEvidence.sources)}\nStructured pricing rows parsed deterministically: ${JSON.stringify(args.documentEvidence.structuredPricingRows ?? [])}\n\n${args.documentEvidence.text}`
    : 'UPLOADED VALUATION / PRICING DOCUMENT EVIDENCE:\nNo uploaded document-library pricing evidence available.'

  const existingBlock = args.existingReport
    ? `\n\nAUTHORITATIVE ADVISOR-EDITED DATA (source of truth — do not echo back in your reply):\n${JSON.stringify({
        pricingPeriods: args.existingReport.pricingPeriods,
        pricingGrid: args.existingReport.pricingGrid,
        priceChanges: args.existingReport.priceChanges,
      })}`
    : ''

  const content: AgentMessageBlock[] = []

  if (args.base64 && args.mediaType) {
    if (args.mediaType === 'application/pdf') {
      content.push({
        type: 'document',
        title: args.fileName,
        source: { type: 'base64', media_type: 'application/pdf', data: args.base64 },
      })
    } else if (args.mediaType.startsWith('image/')) {
      content.push({
        type: 'image',
        source: { media_type: args.mediaType, data: args.base64 },
      })
    }
  }

  content.push({
    type: 'text',
    text: `${websiteContext}\n\n${documentEvidenceContext}\n\n${revenueContext}\n\nBusiness name: ${args.businessName}\nOptional pricing history file: ${args.fileName ?? 'none uploaded'}${existingBlock}\n\n${
      isRerun
        ? 'Return ONLY the partial JSON object described in your system instructions (no grid, no priceChanges array in your output).'
        : 'Return the pricing-by-vertical analysis as JSON. Keep recommendations grounded in evidence; do not invent historical prices.'
    }`,
  })

  const rawText = await createAgentMessage({
    system: isRerun ? rerunSystemPrompt : fullSystemPrompt,
    content,
    maxTokens: isRerun ? 8192 : 12000,
    temperature: 0,
  })

  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = safeParseModelJson(cleaned) as Record<string, unknown>

  const stripRevenueShare = (r: PricingVerticalReport): PricingVerticalReport =>
    enrichVerticalSummariesInReport({
      ...r,
      verticalSummaries: (r.verticalSummaries ?? []).map((v) =>
        normalizeVerticalSummary(v as unknown as Record<string, unknown>, v),
      ),
    })

  if (args.existingReport) {
    const ex = args.existingReport
    const merged: PricingVerticalReport = {
      ...ex,
      generatedAt:
        typeof parsed.generatedAt === 'string' && parsed.generatedAt.trim()
          ? parsed.generatedAt
          : new Date().toISOString(),
      businessName:
        typeof parsed.businessName === 'string' && parsed.businessName.trim()
          ? parsed.businessName
          : ex.businessName,
      currentPricingSource:
        (parsed.currentPricingSource as PricingVerticalReport['currentPricingSource']) ??
        ex.currentPricingSource,
      verticalSummaries:
        Array.isArray(parsed.verticalSummaries) && parsed.verticalSummaries.length > 0
          ? mergeVerticalSummariesForRerun(ex.verticalSummaries, parsed.verticalSummaries)
          : ex.verticalSummaries,
      executiveSummary:
        typeof parsed.executiveSummary === 'string' ? parsed.executiveSummary : ex.executiveSummary,
      overallTrend: typeof parsed.overallTrend === 'string' ? parsed.overallTrend : ex.overallTrend,
      recommendations: Array.isArray(parsed.recommendations)
        ? (parsed.recommendations as string[])
        : ex.recommendations,
      flags: Array.isArray(parsed.flags) ? (parsed.flags as PricingVerticalReport['flags']) : ex.flags,
      pricingPeriods: ex.pricingPeriods,
      pricingGrid: ex.pricingGrid,
      priceChanges: ex.priceChanges,
    }
    return stripRevenueShare(merged)
  }

  return stripRevenueShare(parsed as unknown as PricingVerticalReport)
}
