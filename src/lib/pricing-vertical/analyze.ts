import Anthropic from '@anthropic-ai/sdk'
import type { PricingVerticalReport } from './types'

function extractText(result: Anthropic.Messages.Message): string {
  return result.content
    .filter((block) => block.type === 'text')
    .map((block) => ('text' in block ? block.text : ''))
    .join('')
    .trim()
}

export async function analyzePricingByVertical(args: {
  fileName: string
  base64: string
  mediaType: string
  revenueByVertical: any
}): Promise<PricingVerticalReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required for pricing-by-vertical analysis.')
  }

  const client = new Anthropic({ apiKey })

  const systemPrompt = `You are the Pricing by Vertical Analysis Agent for Cantara, an M&A advisory platform for pet businesses.

You will receive:
1. The seller's pricing schedule history (rate cards, price change logs — uploaded document)
2. Revenue by vertical data from the WS2-3 derived report (JSON)

Your task:
- Extract every price change event from the document over the past 24 months:
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
  - severity "positive" for verticals with healthy pricing momentum
  - severity "informational" for general observations
- Write a concise executive summary (3-5 sentences)
- Describe the overall pricing trend
- Provide 3-6 actionable recommendations with specific dollar amounts

Return ONLY valid JSON matching this exact structure (no markdown, no code fences):
{
  "generatedAt": "<ISO timestamp>",
  "businessName": "<business name>",
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
            text: `${revenueContext}\n\nPlease analyze the seller's pricing history (file: ${args.fileName}) and return the pricing-by-vertical analysis as JSON.`,
          },
        ],
      },
    ],
  })

  const rawText = extractText(response)
  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  return JSON.parse(cleaned) as PricingVerticalReport
}
