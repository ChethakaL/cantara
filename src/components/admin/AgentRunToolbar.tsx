'use client'

import { AgentProviderBar } from '@/components/admin/AgentProviderBar'
import { AgentReportHistoryBar } from '@/components/admin/AgentReportHistoryBar'
import { AgentRunHistoryPanel, type AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'
import type { AgentAiProvider } from '@/lib/agent-model-provider'
import { cn } from '@/components/ui'

export function AgentRunToolbar({
  provider,
  onProviderChange,
  disabled,
  historyItems,
  activeId,
  onSelectRun,
  activeProvider,
  activeModel,
  activeVersion,
  className,
  providerClassName,
  showProvider = true,
}: {
  provider?: AgentAiProvider
  onProviderChange?: (provider: AgentAiProvider) => void
  disabled?: boolean
  historyItems: AgentRunHistoryItem[]
  activeId?: string | null
  onSelectRun: (run: AgentRunHistoryItem) => void
  activeProvider?: string | null
  activeModel?: string | null
  activeVersion?: number | null
  className?: string
  providerClassName?: string
  /** When false, hide Claude/OpenAI selector (agent is locked to one provider). */
  showProvider?: boolean
}) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      {showProvider && provider && onProviderChange ? (
        <AgentProviderBar
          provider={provider}
          onProviderChange={onProviderChange}
          disabled={disabled}
          className={providerClassName}
        />
      ) : (
        <div className="text-xs font-medium text-slate-500">Active: OpenAI</div>
      )}
      {historyItems.length > 0 ? (
        <AgentReportHistoryBar
          runs={historyItems}
          activeId={activeId}
          onSelect={onSelectRun}
          activeProvider={activeProvider}
          activeModel={activeModel}
          activeVersion={activeVersion}
        />
      ) : (
        <AgentRunHistoryPanel runs={[]} activeId={null} onSelect={onSelectRun} />
      )}
    </div>
  )
}
