'use client'

import { AgentRunHistoryPanel, type AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'
import { formatAgentProviderLabel } from '@/lib/agent-model-provider'
import { cn } from '@/components/ui'

export function AgentReportHistoryBar({
  runs,
  activeId,
  onSelect,
  activeProvider,
  activeModel,
  activeVersion,
  label = 'Run history',
  className,
}: {
  runs: AgentRunHistoryItem[]
  activeId?: string | null
  onSelect: (run: AgentRunHistoryItem) => void
  activeProvider?: string | null
  activeModel?: string | null
  activeVersion?: number | null
  label?: string
  className?: string
}) {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {activeProvider && (
        <div className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-slate-400 font-normal">Active:</span>
          <span className="text-slate-700 font-semibold">{formatAgentProviderLabel(activeProvider)}</span>
          {typeof activeVersion === 'number' && (
            <span className="text-slate-400 text-[11px]">v{activeVersion}</span>
          )}
        </div>
      )}
      <AgentRunHistoryPanel runs={runs} activeId={activeId} onSelect={onSelect} label={label} />
    </div>
  )
}
