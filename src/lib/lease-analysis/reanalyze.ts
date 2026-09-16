import type { AgentAiProvider } from '@/lib/agent-model-provider'
import { requireAIClient, resolveModel } from '@/lib/ai-client'
import { createAgentMessage } from '@/lib/llm-completion'
import type { ChecklistItem, LeaseReport } from './types'

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

/** Refresh transaction checklist from advisor-edited flags (no PDF re-read). */
export async function reanalyzeLeaseReportFromEdits(
  existing: LeaseReport,
  options?: { businessName?: string; provider?: AgentAiProvider; modelId?: string },
): Promise<LeaseReport> {
  const provider = options?.provider ?? 'bedrock'
  const authoritative = {
    businessName: options?.businessName || 'Client',
    snapshotTable: existing.snapshotTable ?? [],
    rentSchedule: existing.rentSchedule ?? [],
    redFlags: (existing.redFlags ?? []).map((f) => ({
      issue: f.issue,
      whyItMatters: f.whyItMatters,
      sourceSection: f.sourceSection,
      reviewStatus: f.reviewStatus,
    })),
    orangeFlags: (existing.orangeFlags ?? []).map((f) => ({
      issue: f.issue,
      whyItMatters: f.whyItMatters,
      sourceSection: f.sourceSection,
      reviewStatus: f.reviewStatus,
    })),
    greenFlags: (existing.greenFlags ?? []).map((f) => ({
      issue: f.issue,
      whyItMatters: f.whyItMatters,
      sourceSection: f.sourceSection,
      reviewStatus: f.reviewStatus,
    })),
  }

  const prompt = `You are an expert commercial real-estate / lease diligence analyst for pet hospitality businesses.

An advisor manually corrected lease flags (issues, why it matters, review status).
REWRITE only the transactionChecklist so it reflects those edited flags.
Skip flags marked reviewStatus "not_applicable".
Do NOT invent new rent figures or lease parties.

## AUTHORITATIVE ADVISOR-EDITED DATA
${JSON.stringify(authoritative, null, 2)}

Return ONLY valid JSON:
{
  "transactionChecklist": [
    { "number": 1, "actionItem": "<string>", "priority": "High|Medium|Low", "notes": "<string>" }
  ]
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
    console.error('[Lease Analysis] Reanalyze parse failed:', text.slice(0, 500))
    throw err instanceof Error ? err : new Error('Lease reanalyze returned unparseable JSON.')
  }

  let nextChecklist: ChecklistItem[] = existing.transactionChecklist ?? []
  if (Array.isArray(parsed.transactionChecklist)) {
    nextChecklist = parsed.transactionChecklist
      .map((row, index): ChecklistItem | null => {
        if (!row || typeof row !== 'object') return null
        const r = row as Record<string, unknown>
        const actionItem = typeof r.actionItem === 'string' ? r.actionItem.trim() : ''
        if (!actionItem) return null
        return {
          number: typeof r.number === 'number' ? r.number : index + 1,
          actionItem,
          priority: typeof r.priority === 'string' ? r.priority : 'Medium',
          notes: typeof r.notes === 'string' ? r.notes : '',
        }
      })
      .filter((x): x is ChecklistItem => x !== null)
  }

  return {
    ...existing,
    transactionChecklist: nextChecklist,
    generatedAt: new Date().toISOString(),
  }
}
