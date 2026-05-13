import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from "@/lib/secure-settings"
import type { PricingAnalysisReport } from './types'

function extractText(result: Anthropic.Messages.Message): string {
  return result.content
    .filter((block) => block.type === 'text')
    .map((block) => ('text' in block ? block.text : ''))
    .join('')
    .trim()
}

export async function analyzePricing(args: {
  fileName: string
  base64: string
  mediaType: string
  competitorData: any
}): Promise<PricingAnalysisReport> {
  const apiKey = await getAnthropicApiKey()
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for pricing analysis.')
  }

  const client = new Anthropic({ apiKey })

  const systemPrompt = `You are the Competitive Pricing Analysis Agent for Cantara, an M&A advisory platform for pet businesses.

You will receive:
1. The seller's current pricing schedule (uploaded document)
2. Competitor pricing data extracted from the competitor analysis agent (JSON)

Your task:
- For each service category (Boarding, Daycare, Grooming, Training, Cat Boarding, and any other categories found):
  - Extract the seller's price from the uploaded document
  - Calculate competitor average price and range from the competitor data
  - Compute variance percentage: ((sellerPrice - competitorAvg) / competitorAvg) * 100
  - Classify status:
    - "underpriced" if seller is >10% below market average
    - "at-market" if within +/-10% of market average
    - "premium" if >15% above market average
    - "unknown" if insufficient data
  - Calculate revenue uplift opportunity if the seller increased to market average (estimate annual impact based on reasonable volume assumptions)
- Generate flags:
  - severity "critical" for >20% underpricing
  - severity "warning" for 10-20% underpricing
  - severity "positive" for competitive/premium pricing
  - severity "informational" for general observations
- Write a concise executive summary (3-5 sentences)
- Write a revenue uplift summary explaining total potential uplift
- Provide 3-6 actionable recommendations

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "generatedAt": "<ISO timestamp>",
  "businessName": "<business name>",
  "radiusMiles": <number>,
  "competitorsAnalyzed": <number>,
  "serviceComparisons": [
    {
      "serviceCategory": "<category>",
      "sellerPrice": "<price string>",
      "sellerPriceNumeric": <number|null>,
      "competitorAvgPrice": "<price string>",
      "competitorAvgNumeric": <number|null>,
      "competitorRange": "<range string>",
      "competitorPrices": [{"name": "<competitor>", "price": "<price>"}],
      "variance": "<variance string>",
      "variancePercent": <number|null>,
      "status": "<underpriced|at-market|premium|unknown>",
      "upliftOpportunity": "<opportunity description>",
      "notes": "<notes>"
    }
  ],
  "flags": [
    {
      "id": "<unique id>",
      "severity": "<critical|warning|positive|informational>",
      "category": "<category>",
      "title": "<short title>",
      "description": "<description>"
    }
  ],
  "executiveSummary": "<summary>",
  "revenueUpliftSummary": "<uplift summary>",
  "totalEstimatedUplift": "<total uplift string>",
  "recommendations": ["<rec1>", "<rec2>"]
}`

  const competitorContext = `COMPETITOR PRICING DATA:\n${JSON.stringify(args.competitorData, null, 2)}`

  const documentSource: Anthropic.Messages.Base64ImageSource | Anthropic.Messages.Base64PDFSource =
    args.mediaType === 'application/pdf'
      ? { type: 'base64' as const, media_type: 'application/pdf' as const, data: args.base64 }
      : { type: 'base64' as const, media_type: args.mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp', data: args.base64 }

  const documentBlock: Anthropic.Messages.DocumentBlockParam | Anthropic.Messages.ImageBlockParam =
    args.mediaType === 'application/pdf'
      ? { type: 'document' as const, source: documentSource as Anthropic.Messages.Base64PDFSource }
      : { type: 'image' as const, source: documentSource as Anthropic.Messages.Base64ImageSource }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 5000,
    temperature: 0,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          documentBlock,
          {
            type: 'text',
            text: `${competitorContext}\n\nPlease analyze the seller's pricing schedule (file: ${args.fileName}) against the competitor data above and return the pricing analysis as JSON.`,
          },
        ],
      },
    ],
  })

  const rawText = extractText(response)
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  return JSON.parse(cleaned) as PricingAnalysisReport
}
