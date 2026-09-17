import type { AgentAiProvider } from '@/lib/agent-model-provider'
import { requireAIClient, resolveModel } from '@/lib/ai-client'
import { createAgentMessage } from '@/lib/llm-completion'
import { syncOccupancyReportFromMarkdown, type OccupancyCapacityModel } from '@/lib/occupancy-review/metrics'

export type OccupancyReviewReportLike = {
  clientName: string
  generatedAt: string
  updatedAt?: string
  markdown: string
  capacityModel?: OccupancyCapacityModel
  monthlyData?: Array<{ month: string; boardingDogs: number; daycareDogs: number }>
  computed?: {
    monthlyTotals?: Array<{
      month: string
      boardingDogs: number
      daycareDogs: number
      total: number
      utilization: number
      boardingMix: number
      daycareMix: number
    }>
    peakMonths?: string[]
    troughMonths?: string[]
    avgUtilization?: number
    daycareDisplacementPct?: number
    totalCapacity?: number
  }
  inputs?: Record<string, string | number | boolean | null | string[] | undefined>
}

function stripMarkdownFence(text: string) {
  const t = text.trim()
  const fence = /^```(?:markdown|md)?\s*([\s\S]*?)```$/m.exec(t)
  if (fence) return fence[1].trim()
  return t
}

/**
 * Refresh occupancy narrative from advisor-edited markdown (no document re-read).
 * Edited tables / figures in the draft are treated as authoritative for both
 * the rewritten markdown and the top chart / metric cards.
 */
export async function reanalyzeOccupancyReviewFromEdits(
  existing: OccupancyReviewReportLike,
  options?: { provider?: AgentAiProvider; modelId?: string },
): Promise<OccupancyReviewReportLike> {
  const provider = options?.provider ?? 'bedrock'
  // Chart/metrics follow advisor-edited table numbers.
  const synced = syncOccupancyReportFromMarkdown(existing)
  const capacity = synced.capacityModel ?? {}
  const computed = synced.computed ?? {}

  const prompt = `You are a senior pet resort industry analyst specializing in occupancy optimization and capacity utilization for M&A due diligence at Cantara Pet Advisors.

An advisor manually edited the occupancy review markdown below (tables, utilization figures, and/or narrative).
REWRITE the FULL report as coherent markdown so all commentary matches the advisor-edited facts.

Rules:
- Treat numbers and table rows in the ADVISOR-EDITED MARKDOWN as authoritative. Do NOT invent different monthly figures.
- Keep EXACTLY these section headings in this order:
  ## 1. Methodology Note
  ## 2. Capacity Model Note
  ## 3. Combined Capacity Utilization — 24-Month Trend
  ## 4. Trade-off Commentary
  ## 5. Growth Headroom Implication
- Section 3 must include the monthly utilization table when present in the edited draft (or reconstruct it from structured data if the draft table is incomplete).
- Do not add preamble or meta-commentary. Return markdown only.

## STRUCTURED CAPACITY / METRICS (authoritative after advisor edits)
${JSON.stringify(
  {
    clientName: synced.clientName,
    capacityModel: capacity,
    monthlyData: synced.monthlyData,
    computed: {
      avgUtilization: computed.avgUtilization,
      peakMonths: computed.peakMonths,
      troughMonths: computed.troughMonths,
      daycareDisplacementPct: computed.daycareDisplacementPct,
      totalCapacity: computed.totalCapacity,
      monthlyTotals: computed.monthlyTotals,
    },
  },
  null,
  2,
)}

## ADVISOR-EDITED MARKDOWN
${synced.markdown}`

  let text: string
  if (provider === 'openai') {
    text = await createAgentMessage({
      provider,
      model: options?.modelId,
      system: '',
      content: prompt,
      maxTokens: 12000,
      temperature: 0.15,
    })
  } else {
    const client = await requireAIClient()
    const result = await client.messages.create({
      model: resolveModel(options?.modelId || 'claude-sonnet-4-20250514'),
      max_tokens: 12000,
      temperature: 0.15,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    })
    text = result.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
  }

  const markdown = stripMarkdownFence(text)
  if (!markdown.trim()) {
    throw new Error('Occupancy reanalyze returned empty markdown.')
  }

  // Keep chart metrics from advisor edits; only replace narrative markdown.
  return {
    ...synced,
    markdown,
    updatedAt: new Date().toISOString(),
  }
}
