'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'

export type StoredAgentReport = AgentRunHistoryItem & {
  report?: unknown
  markdown?: string
  documentNames?: string[]
  metadata?: unknown
  version?: number
}

export const GENERIC_AGENT_RUNS_API = '/api/agent-analysis-runs'

function normalizeReportList(data: unknown): StoredAgentReport[] {
  if (Array.isArray(data)) return data as StoredAgentReport[]
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (Array.isArray(record.reports)) return record.reports as StoredAgentReport[]
    if (record.report && typeof record.report === 'object') return [record.report as StoredAgentReport]
  }
  return []
}

function toHistoryItem(run: StoredAgentReport): AgentRunHistoryItem {
  const createdAt =
    typeof run.createdAt === 'string'
      ? run.createdAt
      : run.createdAt
        ? new Date(run.createdAt as string | Date).toISOString()
        : new Date().toISOString()

  const fileName =
    run.fileName ??
    (typeof run.version === 'number' ? `Run v${run.version}` : null) ??
    (run.documentNames?.length ? run.documentNames.join(', ') : 'Analysis run')

  return {
    id: run.id,
    fileName,
    createdAt,
    aiProvider: run.aiProvider ?? run.provider ?? null,
    aiModel: run.aiModel ?? run.model ?? null,
  }
}

export function useAgentReportRuns(
  apiPath: string,
  clientId: string,
  enabled = true,
  agentKey?: string,
) {
  const [runs, setRuns] = useState<StoredAgentReport[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const params = new URLSearchParams({ clientId })
    if (agentKey) params.set('agentKey', agentKey)
    const res = await fetch(`${apiPath}?${params.toString()}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to load report history'))
    const data = await res.json()
    const list = normalizeReportList(data)
    setRuns(list)
    setActiveId((current) => (current && list.some((run) => run.id === current) ? current : list[0]?.id ?? null))
    return list
  }, [apiPath, clientId, agentKey])

  useEffect(() => {
    if (!enabled || !clientId) return
    setLoading(true)
    reload()
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [clientId, enabled, reload])

  const activeRun = useMemo(
    () => runs.find((run) => run.id === activeId) ?? runs[0] ?? null,
    [activeId, runs],
  )

  const historyItems = useMemo(() => runs.map(toHistoryItem), [runs])

  return {
    runs,
    historyItems,
    activeRun,
    activeId,
    setActiveId,
    reload,
    loading,
  }
}
