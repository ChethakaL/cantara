import type { AgentAiProvider } from '@/lib/agent-model-provider'
import { requireAIClient, resolveModel } from '@/lib/ai-client'
import { createAgentMessage } from '@/lib/llm-completion'
import type { ChecklistItem, ContractReport, ContractRiskCard } from './types'

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
 * Refresh recommended actions + transaction checklist from advisor-edited
 * findings / risk cards (no PDF re-read). Edited findings and flags stay frozen.
 */
export async function reanalyzeContractReportFromEdits(
  existing: ContractReport,
  options?: { businessName?: string; provider?: AgentAiProvider; modelId?: string },
): Promise<ContractReport> {
  const provider = options?.provider ?? 'bedrock'
  const authoritative = {
    businessName: options?.businessName || 'Client',
    detailedFindings: (existing.detailedFindings ?? []).map((f) => ({
      id: f.id,
      title: f.title,
      content: f.content,
    })),
    contractRiskCards: (existing.contractRiskCards ?? []).map((c) => ({
      contractId: c.contractId,
      contractName: c.contractName,
      riskTier: c.riskTier,
      redFlagCount: c.redFlags?.length ?? 0,
      orangeFlagCount: c.orangeFlags?.length ?? 0,
      greenFlagCount: c.greenFlags?.length ?? 0,
      redFlags: (c.redFlags ?? []).map((f) => f.issue),
      orangeFlags: (c.orangeFlags ?? []).map((f) => f.issue),
    })),
    snapshotTable: existing.snapshotTable ?? [],
  }

  const prompt = `You are an expert M&A contract diligence analyst for pet hospitality / service businesses.

An advisor manually corrected Material Contracts findings (risk tiers, key terms, notes) and/or risk cards.
REWRITE only:
1) recommendedAction for each contract risk card
2) the transactionChecklist (buyer/counsel action items)

Do NOT invent new contracts. Do NOT contradict the edited findings.

## AUTHORITATIVE ADVISOR-EDITED DATA
${JSON.stringify(authoritative, null, 2)}

Return ONLY valid JSON:
{
  "recommendedActions": [
    { "contractId": "<id>", "recommendedAction": "<one sentence>" }
  ],
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
      maxTokens: 4096,
      temperature: 0,
    })
  } else {
    const client = await requireAIClient()
    const result = await client.messages.create({
      model: resolveModel('claude-sonnet-4-20250514'),
      max_tokens: 4096,
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
    console.error('[Material Contracts] Reanalyze parse failed:', text.slice(0, 500))
    throw err instanceof Error ? err : new Error('Material Contracts reanalyze returned unparseable JSON.')
  }

  const actionById = new Map<string, string>()
  if (Array.isArray(parsed.recommendedActions)) {
    for (const row of parsed.recommendedActions) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const id = typeof r.contractId === 'string' ? r.contractId : ''
      const action = typeof r.recommendedAction === 'string' ? r.recommendedAction.trim() : ''
      if (id && action) actionById.set(id, action)
    }
  }

  const nextCards: ContractRiskCard[] = (existing.contractRiskCards ?? []).map((card) => ({
    ...card,
    recommendedAction: actionById.get(card.contractId) || card.recommendedAction,
  }))

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
    contractRiskCards: nextCards,
    transactionChecklist: nextChecklist,
    generatedAt: new Date().toISOString(),
  }
}
