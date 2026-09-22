import { requireAIClient, resolveModel } from '@/lib/ai-client'
import { createAgentMessage } from '@/lib/llm-completion'
import type { AgentAiProvider } from '@/lib/agent-model-provider'

export type LocationMapStatsSnapshot = {
  total: number
  withinRadius: Record<number, number>
  countWithinRadius: Record<number, number>
  byService: Record<
    'daycare' | 'boarding' | 'grooming',
    { total: number; withinRadius: Record<number, number>; countWithinRadius: Record<number, number> }
  >
  facilityAddress?: string
  clientName?: string
}

/**
 * Refresh the narrative after advisor edits using the selected AI provider.
 */
export async function reanalyzeLocationMapInsightsFromEdits(
  snapshot: LocationMapStatsSnapshot,
  options?: { provider?: AgentAiProvider },
): Promise<{ insights: string[]; narrativeSummary: string }> {
  const prompt = `You are a geographic market analyst for pet hospitality / boarding / daycare M&A diligence.

An advisor manually corrected Client Location Map statistics (radius percentages and/or service breakouts).
Rewrite concise diligence insights that MATCH those edited numbers. Do not invent different percentages.

## AUTHORITATIVE ADVISOR-EDITED STATS
${JSON.stringify(snapshot, null, 2)}

Rules:
- 3-6 short insight bullets grounded in the numbers above.
- Mention concentration within 5 / 10 / 20 mile rings when relevant.
- Call out daycare vs boarding vs grooming proximity differences when totals are non-zero.
- If outer-ring share is high, note destination demand / data-quality risk carefully (not alarmist).
- narrativeSummary: 2-3 sentences suitable for a buyer-facing geographic summary.

Return ONLY valid JSON:
{
  "insights": ["<string>", "..."],
  "narrativeSummary": "<string>"
}`

  let text: string
  if (options?.provider === 'openai') {
    text = await createAgentMessage({ provider: 'openai', system: '', content: prompt, maxTokens: 1200, temperature: 0 })
  } else {
    const client = await requireAIClient()
    const result = await client.messages.create({
      model: resolveModel('claude-sonnet-4-20250514'),
      max_tokens: 1200,
      temperature: 0,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    })
    text = result.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
  }

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned) as Record<string, unknown>
  } catch (err) {
    console.error('[Client Location Map] Reanalyze parse failed:', text.slice(0, 500))
    throw err instanceof Error ? err : new Error('Location map reanalyze returned unparseable JSON.')
  }

  const insights = Array.isArray(parsed.insights)
    ? parsed.insights.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : []
  const narrativeSummary =
    typeof parsed.narrativeSummary === 'string' && parsed.narrativeSummary.trim()
      ? parsed.narrativeSummary.trim()
      : insights.join(' ')

  if (!insights.length) {
    throw new Error('Location map reanalyze returned no insights.')
  }

  return { insights, narrativeSummary }
}
