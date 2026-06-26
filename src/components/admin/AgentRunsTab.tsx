'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot, CheckCircle2, Clock, ExternalLink, Loader2, RefreshCw, FileText, AlertCircle } from 'lucide-react'
import { Badge, Button, Card, cn } from '@/components/ui'
import type { AgentRunRecord, AgentRunStatus } from '@/app/api/agent-runs/route'

const STATUS_META: Record<AgentRunStatus, { label: string; color: 'gray' | 'blue' | 'slate' | 'gold' | 'green' | 'red'; icon: typeof Bot }> = {
  not_started: { label: 'Not Started', color: 'gray', icon: Clock },
  docs_missing: { label: 'Docs Missing', color: 'red', icon: AlertCircle },
  docs_uploaded: { label: 'Requisite Docs Uploaded', color: 'blue', icon: FileText },
  partial_docs: { label: 'Partial Docs Uploaded', color: 'slate', icon: FileText },
  in_review: { label: 'Output in Review', color: 'gold', icon: Bot },
  approved: { label: 'Approved', color: 'green', icon: CheckCircle2 },
}

export default function AgentRunsTab({
  clientId,
  onOpenAgent,
}: {
  clientId: string
  onOpenAgent?: (tabKey: string) => void
}) {
  const [runs, setRuns] = useState<AgentRunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/agent-runs?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setRuns(data.runs ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent runs')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { void load() }, [load])

  const updateStatus = async (agentId: string, status: 'approved' | 'in_review') => {
    setUpdating(agentId)
    try {
      const res = await fetch('/api/agent-runs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, agentId, status }),
      })
      if (!res.ok) throw new Error(await res.text())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdating(null)
    }
  }

  const counts = {
    not_started: runs.filter(r => r.status === 'not_started').length,
    docs_missing: runs.filter(r => r.status === 'docs_missing').length,
    docs_uploaded: runs.filter(r => r.status === 'docs_uploaded' || r.status === 'partial_docs').length,
    in_review: runs.filter(r => r.status === 'in_review').length,
    approved: runs.filter(r => r.status === 'approved').length,
  }

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Agent Runs</h2>
          <p className="text-xs text-slate-400 mt-1">
            Track which agents have been run for this client and whether output is still in review or approved.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {([
          ['in_review', counts.in_review, 'Needs review'],
          ['approved', counts.approved, 'Approved'],
          ['docs_uploaded', counts.docs_uploaded, 'Ready to run'],
          ['docs_missing', counts.docs_missing, 'Docs missing'],
          ['not_started', counts.not_started, 'No doc requirements'],
        ] as const).map(([key, count, sub]) => (
          <Card key={key} className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {key === 'docs_uploaded' ? 'Ready to Run' : STATUS_META[key].label}
            </p>
            <p className="text-2xl font-semibold text-slate-800 mt-1">{count}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </Card>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-400">
              <tr>
                <th className="text-left px-5 py-3 font-medium">Agent</th>
                <th className="text-left px-5 py-3 font-medium">Status</th>
                <th className="text-left px-5 py-3 font-medium">Last Run</th>
                <th className="text-right px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-400 text-sm">
                    {error
                      ? 'Could not load agent runs. Click Refresh to try again.'
                      : 'No agents assigned to this client\'s workstream.'}
                  </td>
                </tr>
              ) : runs.map(run => {
                const meta = STATUS_META[run.status]
                const StatusIcon = meta.icon
                return (
                  <tr
                    key={run.agentKey}
                    onClick={() => {
                      if (run.tabKey && onOpenAgent) {
                        onOpenAgent(run.tabKey)
                      }
                    }}
                    className={cn(
                      "hover:bg-slate-50/60",
                      run.tabKey && onOpenAgent && "cursor-pointer"
                    )}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800 hover:text-indigo-600 transition-colors">{run.label}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={cn(
                          run.missingDocs && run.missingDocs.length > 0 && "cursor-help"
                        )}
                        title={
                          run.missingDocs && run.missingDocs.length > 0
                            ? `Missing documents:\n${run.missingDocs.map(d => `• ${d.name}`).join('\n')}`
                            : undefined
                        }
                      >
                        <Badge
                          color={meta.color}
                          className="inline-flex items-center gap-1.5"
                        >
                          <StatusIcon className="w-3 h-3" />
                          {meta.label}
                        </Badge>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {run.runAt ? new Date(run.runAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {/* {run.tabKey && onOpenAgent && (
                          <button
                            type="button"
                            onClick={() => onOpenAgent(run.tabKey!)}
                            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
                          >
                            Open <ExternalLink className="w-3 h-3" />
                          </button>
                        )} */}
                        {run.status === 'in_review' && (
                          <button
                            type="button"
                            disabled={updating === run.agentId}
                            onClick={() => void updateStatus(run.agentId, 'approved')}
                            className={cn(
                              'text-xs font-medium px-2.5 py-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50',
                            )}
                          >
                            {updating === run.agentId ? 'Saving…' : 'Mark Approved'}
                          </button>
                        )}
                        {run.status === 'approved' && (
                          <button
                            type="button"
                            disabled={updating === run.agentId}
                            onClick={() => void updateStatus(run.agentId, 'in_review')}
                            className="text-xs font-medium px-2.5 py-1 rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                          >
                            Reopen Review
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
