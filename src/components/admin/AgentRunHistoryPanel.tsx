'use client'

import { useState } from 'react'
import { History } from 'lucide-react'
import { Button, Modal } from '@/components/ui'
import { formatAgentProviderLabel, formatAgentRunLabel } from '@/lib/agent-model-provider'

export type AgentRunHistoryItem = {
  id: string
  fileName?: string | null
  createdAt: string
  aiProvider?: string | null
  aiModel?: string | null
  model?: string | null
  provider?: string | null
}

export function AgentRunHistoryPanel<T extends AgentRunHistoryItem>({
  runs,
  activeId,
  onSelect,
  label = 'Run history',
}: {
  runs: T[]
  activeId?: string | null
  onSelect: (run: T) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 h-8 font-medium" onClick={() => setOpen(true)}>
        <History className="w-3.5 h-3.5 text-slate-500" />
        <span>{label}</span>
        <span className="ml-0.5 rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600">
          {runs.length}
        </span>
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={label}>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {runs.length === 0 && (
            <p className="text-sm text-slate-500 px-1 py-6 text-center">
              No saved runs yet. Run an analysis to create version history.
            </p>
          )}
          {runs.map(run => {
            const provider = run.aiProvider ?? run.provider ?? 'bedrock'
            const model = run.aiModel ?? run.model ?? null
            const isActive = run.id === activeId
            return (
              <button
                key={run.id}
                type="button"
                onClick={() => {
                  onSelect(run)
                  setOpen(false)
                }}
                className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                  isActive
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {run.fileName || 'Analysis run'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatAgentRunLabel({
                        provider,
                        model,
                        createdAt: run.createdAt,
                      })}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    {formatAgentProviderLabel(provider)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </Modal>
    </>
  )
}
