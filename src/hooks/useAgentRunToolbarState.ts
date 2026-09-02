'use client'

import { useCallback, useEffect } from 'react'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import type { AgentRunKey } from '@/lib/agent-run-keys'

export function useAgentRunToolbarState(clientId: string, agentKey: AgentRunKey, enabled = true) {
  const {
    runs,
    historyItems,
    activeRun,
    activeId,
    setActiveId,
    reload,
    loading,
  } = useGenericAgentRuns(clientId, agentKey, enabled)

  const selectRun = useCallback(
    (run: AgentRunHistoryItem, onSelect: (report: unknown) => void) => {
      setActiveId(run.id)
      const full = runs.find((item) => item.id === run.id)
      if (full?.report != null) onSelect(full.report)
      else if (full?.markdown) onSelect({ markdown: full.markdown, ...(typeof full.metadata === 'object' && full.metadata ? full.metadata as object : {}) })
    },
    [runs, setActiveId],
  )

  const applyActiveRun = useCallback(
    (onSelect: (report: unknown) => void) => {
      if (loading) return false
      if (!activeRun) return true
      if (activeRun.report != null) {
        onSelect(activeRun.report)
        return true
      }
      if (activeRun.markdown) {
        onSelect({ markdown: activeRun.markdown, ...(typeof activeRun.metadata === 'object' && activeRun.metadata ? activeRun.metadata as object : {}) })
        return true
      }
      return true
    },
    [activeRun, loading],
  )

  return {
    runs,
    historyItems,
    activeRun,
    activeId,
    setActiveId,
    reload,
    loading,
    selectRun,
    applyActiveRun,
  }
}

/** Load report from active run once history finishes loading. */
export function useLoadReportFromActiveRun(
  loading: boolean,
  activeRun: { report?: unknown; markdown?: string | null; metadata?: unknown } | null,
  onLoad: (report: unknown) => void,
  isEmpty?: (report: unknown) => boolean,
) {
  useEffect(() => {
    if (loading) return
    if (!activeRun) return
    const payload =
      activeRun.report ??
      (activeRun.markdown
        ? { markdown: activeRun.markdown, ...(typeof activeRun.metadata === 'object' && activeRun.metadata ? activeRun.metadata as object : {}) }
        : null)
    if (payload == null) return
    if (isEmpty?.(payload)) return
    onLoad(payload)
  }, [activeRun, loading, onLoad, isEmpty])
}
