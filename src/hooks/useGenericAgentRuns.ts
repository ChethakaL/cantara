'use client'

import { GENERIC_AGENT_RUNS_API, useAgentReportRuns } from '@/hooks/useAgentReportRuns'
import type { AgentRunKey } from '@/lib/agent-run-keys'

export function useGenericAgentRuns(clientId: string, agentKey: AgentRunKey, enabled = true) {
  return useAgentReportRuns(GENERIC_AGENT_RUNS_API, clientId, enabled, agentKey)
}
