import type { AgentAiProvider } from '@/lib/agent-model-provider'
import { requireAIClient, resolveModel } from '@/lib/ai-client'
import { createAgentMessage } from '@/lib/llm-completion'
import type { BuyerSummary, WS16Report } from '@/types/ws1-6-types'

function stripJsonFence(text: string) {
  const t = text.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t)
  if (fence) return fence[1].trim()
  return t
}

function parseJson(text: string): unknown {
  const cleaned = stripJsonFence(text)
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1))
    }
    throw new Error('Model did not return valid JSON.')
  }
}

/**
 * Refresh buyer-facing summary + counsel items from advisor-edited tables
 * (documents, agreements, non-competes, benefits, contractors, key people).
 */
export async function reanalyzeEmployeeObligationsFromEdits(
  existing: WS16Report,
  options?: { provider?: AgentAiProvider; modelId?: string },
): Promise<WS16Report> {
  const provider = options?.provider ?? 'bedrock'
  const authoritative = {
    clientName: existing.clientName,
    documents: existing.documents,
    agreements: existing.agreements,
    nonCompetes: existing.nonCompetes,
    benefits: existing.benefits,
    contractors: existing.contractors,
    keyPeople: existing.keyPeople,
    keyPersonNarrative: existing.keyPersonNarrative,
  }

  const prompt = `You are an employment diligence analyst for pet hospitality / service business M&A.

An advisor manually corrected Employee Obligations tables (documents, agreements, non-competes, benefits, contractors, key people).
REWRITE only the buyer-facing summary fields to match those edited facts. Do NOT invent parties or agreements not present below.

## AUTHORITATIVE ADVISOR-EDITED DATA
${JSON.stringify(authoritative, null, 2)}

Return ONLY valid JSON:
{
  "buyerSummary": {
    "workforceOverview": "<string>",
    "nonCompeteProtections": "<string>",
    "assumedBenefitObligations": "<string>",
    "retirementAndPTO": "<string>",
    "independentContractorRisk": "<string>",
    "transitionConsiderations": "<string>",
    "counselItems": ["<string>", ...]
  },
  "keyPersonNarrative": "<optional updated narrative or omit to keep existing>"
}`

  let text: string
  if (provider === 'openai') {
    text = await createAgentMessage({
      provider,
      model: options?.modelId,
      system: '',
      content: prompt,
      maxTokens: 3072,
      temperature: 0,
    })
  } else {
    const client = await requireAIClient()
    const result = await client.messages.create({
      model: resolveModel('claude-sonnet-4-20250514'),
      max_tokens: 3072,
      temperature: 0,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    })
    text = result.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
  }

  let parsed: Record<string, unknown>
  try {
    parsed = parseJson(text) as Record<string, unknown>
  } catch (err) {
    console.error('[Employee Obligations] Reanalyze parse failed:', text.slice(0, 500))
    throw err instanceof Error ? err : new Error('Employee Obligations reanalyze returned unparseable JSON.')
  }

  const prev = existing.buyerSummary
  let nextSummary: BuyerSummary = prev
  if (parsed.buyerSummary && typeof parsed.buyerSummary === 'object') {
    const s = parsed.buyerSummary as Record<string, unknown>
    nextSummary = {
      workforceOverview:
        typeof s.workforceOverview === 'string' && s.workforceOverview.trim()
          ? s.workforceOverview
          : prev.workforceOverview,
      nonCompeteProtections:
        typeof s.nonCompeteProtections === 'string' && s.nonCompeteProtections.trim()
          ? s.nonCompeteProtections
          : prev.nonCompeteProtections,
      assumedBenefitObligations:
        typeof s.assumedBenefitObligations === 'string' && s.assumedBenefitObligations.trim()
          ? s.assumedBenefitObligations
          : prev.assumedBenefitObligations,
      retirementAndPTO:
        typeof s.retirementAndPTO === 'string' && s.retirementAndPTO.trim()
          ? s.retirementAndPTO
          : prev.retirementAndPTO,
      independentContractorRisk:
        typeof s.independentContractorRisk === 'string' && s.independentContractorRisk.trim()
          ? s.independentContractorRisk
          : prev.independentContractorRisk,
      transitionConsiderations:
        typeof s.transitionConsiderations === 'string' && s.transitionConsiderations.trim()
          ? s.transitionConsiderations
          : prev.transitionConsiderations,
      counselItems: Array.isArray(s.counselItems)
        ? s.counselItems.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : prev.counselItems,
    }
  }

  return {
    ...existing,
    buyerSummary: nextSummary,
    keyPersonNarrative:
      typeof parsed.keyPersonNarrative === 'string' && parsed.keyPersonNarrative.trim()
        ? parsed.keyPersonNarrative
        : existing.keyPersonNarrative,
    generatedAt: new Date().toISOString(),
  }
}
