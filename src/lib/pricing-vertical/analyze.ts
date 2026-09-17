import type { PricingVerticalReport } from './types'
import type { ServicePricingRow } from './types'
import type { WebsiteResearchData } from '@/lib/competitor-analysis/types'
import type { PricingNativeDocument } from '@/lib/pricing-vertical/document-evidence'
import { safeParseModelJson } from '@/lib/pricing-vertical/parse-model-json'
import { mergeVerticalSummariesForRerun, normalizeVerticalSummary } from '@/lib/pricing-vertical/normalize-vertical-summaries'
import { enrichVerticalSummariesInReport } from '@/lib/pricing-vertical/enrich-vertical-summaries-from-grid'
import {
  normalizePriceChangeEvent,
  normalizePricingVerticalReport,
} from '@/lib/pricing-vertical/normalize-report'
import { requireAIClient, resolveModel } from '@/lib/ai-client'
import { getActiveAgentModelId, getActiveAgentProvider } from '@/lib/agent-llm-context'
import { createAgentMessage, type AgentMessageBlock } from '@/lib/llm-completion'

/**
 * On update-from-edits, take the model's reconciled grid/timeline when present.
 * Do not prefer a "richer" prior grid — that blocked intentional freezes / removed increases.
 */
function takeReconciledStructure(
  previous: PricingVerticalReport,
  incoming: Partial<PricingVerticalReport> | Record<string, unknown>,
): { pricingPeriods: string[]; pricingGrid: ServicePricingRow[]; priceChanges: PricingVerticalReport['priceChanges'] } {
  const prevPeriods = previous.pricingPeriods ?? []
  const nextPeriods =
    Array.isArray(incoming.pricingPeriods) && (incoming.pricingPeriods as string[]).length > 0
      ? (incoming.pricingPeriods as string[])
      : prevPeriods
  const nextGrid =
    Array.isArray(incoming.pricingGrid) && (incoming.pricingGrid as ServicePricingRow[]).length > 0
      ? (incoming.pricingGrid as ServicePricingRow[])
      : previous.pricingGrid
  // Empty priceChanges[] is valid (advisor removed all events).
  const nextChanges = Array.isArray(incoming.priceChanges)
    ? (incoming.priceChanges as unknown[]).map(normalizePriceChangeEvent)
    : (previous.priceChanges ?? []).map(normalizePriceChangeEvent)

  return {
    pricingPeriods: nextPeriods,
    pricingGrid: nextGrid,
    priceChanges: nextChanges,
  }
}

function buildNativeContentBlocks(nativeDocuments: PricingNativeDocument[]): any[] {
  const blocks: any[] = []
  for (const doc of nativeDocuments) {
    const mime = (doc.mimeType || '').toLowerCase()
    const lower = doc.fileName.toLowerCase()

    if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(lower)) {
      blocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mime.startsWith('image/') ? mime : 'image/png',
          data: doc.base64,
        },
      })
      continue
    }

    // PDFs + spreadsheets + other files: send as native document blocks (Claude / Bedrock).
    const mediaType =
      mime === 'application/pdf' || lower.endsWith('.pdf')
        ? 'application/pdf'
        : mime || 'application/octet-stream'

    blocks.push({
      type: 'document',
      title: doc.fileName,
      source: {
        type: 'base64',
        media_type: mediaType.includes('spreadsheet') || mediaType.includes('excel') || /\.(xlsx|xls)$/i.test(lower)
          ? mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : mediaType,
        data: doc.base64,
      },
    })
  }
  return blocks
}

function spreadsheetTextAppendix(nativeDocuments: PricingNativeDocument[]): string {
  const parts = nativeDocuments
    .filter((d) => d.spreadsheetText?.trim())
    .map((d) => `=== SPREADSHEET TEXT EXTRACT: ${d.fileName} ===\n${d.spreadsheetText}`)
  if (!parts.length) return ''
  return `\n\nSPREADSHEET CELL TEXT (full extract — use this together with any native spreadsheet attachment):\n${parts.join('\n\n')}`
}

async function invokePricingModel(args: {
  system: string
  textPrompt: string
  nativeDocuments: PricingNativeDocument[]
  legacyFile?: { fileName?: string; base64?: string; mediaType?: string }
  maxTokens: number
}): Promise<string> {
  const provider = getActiveAgentProvider()
  const modelId = getActiveAgentModelId()
  const nativeBlocks = buildNativeContentBlocks(args.nativeDocuments)

  if (args.legacyFile?.base64 && args.legacyFile.mediaType) {
    const mime = args.legacyFile.mediaType
    if (mime === 'application/pdf') {
      nativeBlocks.push({
        type: 'document',
        title: args.legacyFile.fileName,
        source: { type: 'base64', media_type: 'application/pdf', data: args.legacyFile.base64 },
      })
    } else if (mime.startsWith('image/')) {
      nativeBlocks.push({
        type: 'image',
        source: { type: 'base64', media_type: mime, data: args.legacyFile.base64 },
      })
    }
  }

  if (provider === 'openai') {
    const content: AgentMessageBlock[] = [
      ...nativeBlocks.map((block) => {
        if (block.type === 'document') {
          return {
            type: 'document' as const,
            title: block.title,
            source: block.source,
          }
        }
        if (block.type === 'image') {
          return {
            type: 'image' as const,
            source: { media_type: block.source?.media_type, data: block.source?.data },
          }
        }
        return { type: 'text' as const, text: '' }
      }),
      { type: 'text', text: args.textPrompt },
    ]
    return createAgentMessage({
      provider,
      model: modelId,
      system: args.system,
      content: content.filter((b) => b.type !== 'text' || b.text.trim()),
      maxTokens: args.maxTokens,
      temperature: 0,
    })
  }

  // Bedrock / Anthropic: send native document + image blocks (same pattern as org-chart / insurance).
  const client = await requireAIClient()
  const model = resolveModel(modelId || 'claude-sonnet-4-20250514')

  const runOnce = async (blocks: any[]) => {
    const response = await client.messages.create({
      model,
      max_tokens: args.maxTokens,
      temperature: 0,
      system: args.system,
      messages: [{ role: 'user', content: [...blocks, { type: 'text', text: args.textPrompt }] }],
    })
    return response.content
      .filter((b) => b.type === 'text')
      .map((b) => ('text' in b ? b.text : ''))
      .join('')
  }

  try {
    return await runOnce(nativeBlocks)
  } catch (error) {
    // Some Bedrock deployments reject non-PDF document media types (xlsx). Retry PDF/images only;
    // spreadsheet cell text is already in the prompt via spreadsheetTextAppendix.
    const pdfOrImageOnly = nativeBlocks.filter((block) => {
      if (block.type === 'image') return true
      const media = String(block.source?.media_type || '').toLowerCase()
      return media === 'application/pdf'
    })
    if (pdfOrImageOnly.length === nativeBlocks.length) throw error
    console.warn(
      '[pricing-vertical] Native attachment call failed; retrying with PDF/images only:',
      error instanceof Error ? error.message : error,
    )
    return await runOnce(pdfOrImageOnly)
  }
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
  /** Advisor-selected PDFs / xlsx / images sent natively to the model. */
  nativeDocuments?: PricingNativeDocument[]
  /** When set, reanalyze from advisor edits (full consistency pass). */
  existingReport?: PricingVerticalReport | null
}): Promise<PricingVerticalReport> {
  const isRerun = Boolean(args.existingReport)
  const nativeDocuments = args.nativeDocuments ?? []

  const fullSystemPrompt = `You are the Pricing by Vertical Analysis Agent for Cantara, an M&A advisory platform for pet businesses.

You will receive:
1. Current public website pricing evidence, when available
2. Advisor-selected pricing / revenue documents attached as native files (PDF, Excel/xlsx, images) and/or text extracts
3. Revenue by vertical data from the WS2-3 derived report (JSON) — internal context only

CRITICAL — grid and timeline must match the narrative:
- If documents state periodic / yearly price increases (e.g. ~10% annual or spring increases), you MUST encode them in BOTH:
  (a) priceChanges[] timeline rows with percentChange, and
  (b) historical cells on pricingGrid (not only Current).
- Do NOT write about increases in executiveSummary / overallTrend while leaving historical grid columns blank and priceChanges empty.
- Prefer dated period labels from the spreadsheet (e.g. May 2024, Nov 2024, May 2025, Nov 2025, Current) when the file uses them.
- For Excel/xlsx attachments: read every relevant sheet (rack rates, historical pricing, price change analysis). Use the spreadsheet text extract when provided.
- Image-only / unreadable scans may stay blank for those files — still use any readable PDF/xlsx fully.

Your task:
- Primary objective: document pricing increase history over the past 24 months and comment on frequency and magnitude of increases.
- Identify current prices for every service found in website evidence and/or uploaded documents. Use pet resort services such as Boarding, Daycare, Grooming, Training, Cat Boarding, Membership, Retail, Wellness, and Other.
- Build an editable multi-period price grid. Fill historical period cells whenever documents support them.
- Do NOT emphasize or summarize revenue mix or "revenue share by vertical" in executiveSummary, overallTrend, recommendations, or flags. WS2-3 revenue JSON is for internal context only; never output revenue percentages or share-of-revenue commentary.
- Extract every price change event from the evidence over the past 24 months.
- For each service vertical: count changes, avg/total change %, last change date, trend, empty revenueShare, specific recommendation.
- Generate pricing-only flags; write executiveSummary, overallTrend, and 3–6 recommendations.

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
  "pricingPeriods": ["Current", "<older period labels from evidence>"],
  "pricingGrid": [
    {
      "id": "<stable-slug>",
      "serviceName": "<service name>",
      "vertical": "<vertical>",
      "source": "<website|document|manual|ai_inferred>",
      "sourceUrl": "<source url if any>",
      "confidence": "<high|medium|low>",
      "prices": { "Current": "<price>", "<period>": "<price or empty>" }
    }
  ],
  "priceChanges": [
    {
      "date": "<date>",
      "serviceVertical": "<vertical — use serviceVertical, NOT vertical>",
      "previousPrice": "<price — use previousPrice, NOT priorPrice>",
      "newPrice": "<price>",
      "dollarChange": <number|null>,
      "percentChange": <number|null — use percentChange, NOT changePercent>,
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

An advisor edited an existing Pricing by Vertical report. You receive:
1. The FULL advisor-edited report JSON (ground truth for what they changed)
2. Optional re-attached native pricing documents (PDF / xlsx / images) and text extracts
3. Website + WS2-3 internal context (do not output revenue-mix commentary)

Consistency rules:
- Honor advisor edits to pricingGrid cells, priceChanges rows, overallTrend, executiveSummary, verticalSummaries, and recommendations.
- If narrative / overallTrend / notes claim price increases (e.g. ~10% yearly) but the grid historical cells or priceChanges timeline are empty or contradict that claim, UPDATE pricingGrid historical cells AND priceChanges so the structured data matches the claim (infer prior-period prices from Current when the % increase is stated).
- If the advisor says increases were frozen, skipped, or reduced for a vertical/period, UPDATE the grid and REMOVE or revise matching priceChanges rows — do not keep prior richer history that contradicts the correction.
- When filling blank history from a stated %, prefer richer grids; when the advisor explicitly corrects history downward, the correction wins.
- Set revenueShare to "" always.
- Refresh flags and recommendations to match the final grid + timeline.
- Return the FULL report JSON (same schema as a fresh analysis), not a partial object.

Return ONLY valid JSON (no markdown, no code fences).`

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
    ? `UPLOADED VALUATION / PRICING DOCUMENT TEXT EVIDENCE:\nSources: ${JSON.stringify(args.documentEvidence.sources)}\nStructured pricing rows parsed deterministically: ${JSON.stringify(args.documentEvidence.structuredPricingRows ?? [])}\n\n${args.documentEvidence.text}`
    : 'UPLOADED VALUATION / PRICING DOCUMENT TEXT EVIDENCE:\nNo text extracts available (rely on native file attachments when present).'

  const nativeList =
    nativeDocuments.length > 0
      ? `NATIVE FILES ATTACHED (${nativeDocuments.length}):\n${nativeDocuments.map((d, i) => `${i + 1}. ${d.fileName} (${d.mimeType})`).join('\n')}`
      : 'NATIVE FILES ATTACHED: none'

  const existingBlock = args.existingReport
    ? `\n\nAUTHORITATIVE ADVISOR-EDITED REPORT (source of truth — reconcile grid/timeline with narrative):\n${JSON.stringify(args.existingReport)}`
    : ''

  const textPrompt = `${websiteContext}\n\n${documentEvidenceContext}\n\n${revenueContext}\n\n${nativeList}${spreadsheetTextAppendix(nativeDocuments)}\n\nBusiness name: ${args.businessName}\nOptional single pricing history file: ${args.fileName ?? 'none'}${existingBlock}\n\n${
    isRerun
      ? 'Return the FULL pricing-by-vertical JSON report, keeping advisor edits and ensuring grid + priceChanges reflect any stated increases.'
      : 'Return the pricing-by-vertical analysis as JSON. Fill historical grid cells and priceChanges whenever documents support them; do not invent unsupported prices.'
  }`

  const rawText = await invokePricingModel({
    system: isRerun ? rerunSystemPrompt : fullSystemPrompt,
    textPrompt,
    nativeDocuments,
    legacyFile: { fileName: args.fileName, base64: args.base64, mediaType: args.mediaType },
    maxTokens: isRerun ? 12000 : 14000,
  })

  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  const parsed = safeParseModelJson(cleaned) as Record<string, unknown>

  const stripRevenueShare = (r: PricingVerticalReport): PricingVerticalReport =>
    enrichVerticalSummariesInReport(
      normalizePricingVerticalReport({
        ...r,
        verticalSummaries: (r.verticalSummaries ?? []).map((v) =>
          normalizeVerticalSummary(v as unknown as Record<string, unknown>, v),
        ),
      }),
    )

  if (args.existingReport) {
    const ex = args.existingReport
    const structure = takeReconciledStructure(ex, parsed)
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
      pricingPeriods: structure.pricingPeriods,
      pricingGrid: structure.pricingGrid,
      priceChanges: structure.priceChanges,
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
    }
    return stripRevenueShare(merged)
  }

  return stripRevenueShare(parsed as unknown as PricingVerticalReport)
}
