import type { AgentAiProvider } from '@/lib/agent-model-provider'
import type { AgentRunKey } from '@/lib/agent-run-keys'

export async function saveAgentAnalysisRunClient(args: {
  clientId: string
  agentKey: AgentRunKey
  fileName?: string
  report?: unknown
  markdown?: string
  documentNames?: string[]
  metadata?: unknown
  aiProvider: AgentAiProvider | string
  aiModel?: string | null
}) {
  const res = await fetch('/api/agent-analysis-runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) {
    throw new Error(await res.text().catch(() => 'Failed to save agent run'))
  }
  return res.json() as Promise<{ report: Record<string, unknown> }>
}
