import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from "@/lib/secure-settings"
import type { PricingVerticalReport } from './types'
import type { ServicePricingRow } from './types'
import type { WebsiteResearchData } from '@/lib/competitor-analysis/types'

function extractText(result: Anthropic.Messages.Message): string {
  return result.content
    .filter((block) => block.type === 'text')
    .map((block) => ('text' in block ? block.text : ''))
    .join('')
    .trim()
}

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
}): Promise<PricingVerticalReport> {
  const apiKey = await getAnthropicApiKey()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for pricing-by-vertical analysis.')
  }

  const client = new Anthropic({ apiKey })

  const systemPrompt = `You are the Pricing by Vertical Analysis Agent for Cantara, an M&A advisory platform for pet businesses.

You will receive:
1. Current public website pricing evidence, when available
2. Optional seller pricing history document, when uploaded
3. Uploaded valuation / pricing / revenue document evidence from the client document library, when available
4. Revenue by vertical data from the WS2-3 derived report (JSON)

Your task:
- Identify current prices for every service found in website evidence and/or uploaded documents. Use pet resort services such as Boarding, Daycare, Grooming, Training, Cat Boarding, Membership, Retail, Wellness, and Other.
- Build an editable 24-month price grid with 6-month interval columns. Current prices must be filled from website evidence where available. Historical period cells should be filled from uploaded document-library evidence or the optional uploaded file only when explicitly supported by dates/effective periods. Leave unknown cells blank.
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
  - Map revenue share from WS2-3 data (e.g. "42% of TTM revenue")
  - Write a specific recommendation (e.g. "Increase boarding rate by $3/night to $48/night effective Q3 2026")
- Generate flags:
  - severity "critical" for verticals with no price increase in 12+ months AND significant revenue share (>20%)
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
      "revenueShare": "<share string>",
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

  const revenueContext = `REVENUE BY VERTICAL DATA (from WS2-3):\n${JSON.stringify(args.revenueByVertical, null, 2)}`
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

  const content: Anthropic.Messages.MessageParam['content'] = []

  if (args.base64 && args.mediaType) {
    const documentSource: Anthropic.Messages.Base64ImageSource | Anthropic.Messages.Base64PDFSource =
      args.mediaType === 'application/pdf'
        ? { type: 'base64' as const, media_type: 'application/pdf' as const, data: args.base64 }
        : { type: 'base64' as const, media_type: args.mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', data: args.base64 }

    const documentBlock: Anthropic.Messages.DocumentBlockParam | Anthropic.Messages.ImageBlockParam =
      args.mediaType === 'application/pdf'
        ? { type: 'document' as const, source: documentSource as Anthropic.Messages.Base64PDFSource }
        : { type: 'image' as const, source: documentSource as Anthropic.Messages.Base64ImageSource }
    content.push(documentBlock)
  }

  content.push({
    type: 'text',
    text: `${websiteContext}\n\n${documentEvidenceContext}\n\n${revenueContext}\n\nBusiness name: ${args.businessName}\nOptional pricing history file: ${args.fileName ?? 'none uploaded'}\n\nReturn the pricing-by-vertical analysis as JSON. Keep recommendations grounded in evidence; do not invent historical prices.`,
  })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 5000,
    temperature: 0,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content,
      },
    ],
  })

  const rawText = extractText(response)
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  return JSON.parse(cleaned) as PricingVerticalReport
}
