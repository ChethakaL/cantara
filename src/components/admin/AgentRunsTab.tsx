'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { Bot, CheckCircle2, Clock, Loader2, RefreshCw, FileText, AlertCircle, Send, Eye, EyeOff, RotateCcw, Lock } from 'lucide-react'
import { Badge, Button, Card, cn } from '@/components/ui'
import type { AgentReviewer, AgentRunRecord, AgentRunStatus } from '@/app/api/agent-runs/route'

const STATUS_META: Record<AgentRunStatus, { label: string; color: 'gray' | 'blue' | 'slate' | 'gold' | 'green' | 'red'; icon: typeof Bot }> = {
  not_started: { label: 'Docs Not Run', color: 'gray', icon: Clock },
  docs_missing: { label: 'Docs Missing', color: 'red', icon: AlertCircle },
  advisor_to_run: { label: 'Advisor to Run', color: 'blue', icon: Bot },
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
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '—'
    return d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })
  }
  const [reviewers, setReviewers] = useState<AgentReviewer[]>([])
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
      setReviewers(data.reviewers ?? [])
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

  const updateClientRelease = async (agentId: string, clientReleased: boolean) => {
    setUpdating(agentId)
    try {
      const res = await fetch('/api/agent-runs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, agentId, clientReleased }),
      })
      if (!res.ok) throw new Error(await res.text())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update client release')
    } finally {
      setUpdating(null)
    }
  }

  const updateFacilityReviewMode = async (agentId: string, facilityReviewMode: '360' | 'advisor') => {
    setUpdating(`${agentId}:mode`)
    try {
      const res = await fetch('/api/agent-runs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, agentId, facilityReviewMode }),
      })
      if (!res.ok) throw new Error(await res.text())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update facility review mode')
    } finally {
      setUpdating(null)
    }
  }

  const releaseAllApproved = async () => {
    setUpdating('release-all')
    try {
      const res = await fetch('/api/agent-runs/release-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      if (!res.ok) throw new Error(await res.text())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to release approved reports')
    } finally {
      setUpdating(null)
    }
  }

  const updateAdvisorToRun = async (agentId: string, advisorToRun: boolean) => {
    setUpdating(`${agentId}:advisorToRun`)
    try {
      const res = await fetch('/api/agent-runs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, agentId, advisorToRun }),
      })
      if (!res.ok) throw new Error(await res.text())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update advisor run flag')
    } finally {
      setUpdating(null)
    }
  }

  const updateAssignedTo = async (agentId: string, assignedTo: string) => {
    setUpdating(agentId)
    try {
      const res = await fetch('/api/agent-runs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, agentId, assignedTo }),
      })
      if (!res.ok) throw new Error(await res.text())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update assignment')
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
          <h2 className="text-lg font-semibold text-slate-800">Agent Status</h2>
          <p className="text-xs text-slate-400 mt-1">
            Track which agents have been run for this client and whether output is still in review or approved.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {runs.some(r => r.status === 'approved' && !r.clientReleased) && (
            <button
              onClick={releaseAllApproved}
              disabled={updating === 'release-all'}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-cantara-gold/30 bg-[#CAA15F]/10 text-cantara-navy hover:bg-[#CAA15F]/20 transition-colors disabled:opacity-50"
            >
              {updating === 'release-all' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Releasing...
                </>
              ) : (
                'Release All Approved'
              )}
            </button>
          )}
          <Button variant="outline" size="sm" onClick={() => void load()} className="text-xs">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {([
          ['docs_missing', counts.docs_missing, 'Required docs missing'],
          ['not_started', counts.not_started, 'Docs not run yet'],
          ['in_review', counts.in_review, 'Needs review'],
          ['approved', counts.approved, 'Approved'],
          ['docs_uploaded', counts.docs_uploaded, 'Ready to run'],
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
          <table className="w-full min-w-[980px] lg:min-w-[1080px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-400">
              <tr>
                <th className="text-left px-4 md:px-5 py-3 font-medium">Agent</th>
                <th className="text-left px-4 md:px-5 py-3 font-medium">Assigned To</th>
                <th className="text-left px-4 md:px-5 py-3 font-medium">Status</th>
                <th className="text-left px-4 md:px-5 py-3 font-medium">Client Release</th>
                <th className="text-left px-4 md:px-5 py-3 font-medium">Last Run</th>
                <th className="text-right px-4 md:px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 md:px-5 py-10 text-center text-slate-400 text-sm">
                    {error
                      ? 'Could not load agent runs. Click Refresh to try again.'
                      : 'No agents assigned to this client\'s workstream.'}
                  </td>
                </tr>
              ) : runs.map((run, idx) => {
                const meta = STATUS_META[run.status]
                const StatusIcon = meta.icon
                const showCategory = idx === 0 || runs[idx - 1]?.category !== run.category
                return (
                  <Fragment key={run.agentKey}>
                    {showCategory && (
                      <tr key={`${run.category}-header`} className="bg-white">
                        <td colSpan={6} className="px-4 md:px-5 pt-5 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                          {run.category}
                        </td>
                      </tr>
                    )}
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
                      <td className="px-4 md:px-5 py-3">
                        <p className="font-medium text-slate-800 hover:text-indigo-600 transition-colors">{run.label}</p>
                        {run.agentKey === 'facilityReview' && (
                          <div className="mt-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[10px] text-slate-400 font-medium">Mode:</span>
                            <select
                              value={run.facilityReviewMode ?? '360'}
                              disabled={updating === `${run.agentId}:mode`}
                              onChange={event => void updateFacilityReviewMode(run.agentId, event.target.value as '360' | 'advisor')}
                              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                            >
                              <option value="360">360 Review</option>
                              <option value="advisor">Advisor Review</option>
                            </select>
                          </div>
                        )}
                        {run.agentKey === 'legalEntitySearch' && (
                          <div className="mt-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[10px] text-slate-400 font-medium">Manual:</span>
                            <select
                              value={run.advisorToRun ? 'advisor' : 'standard'}
                              disabled={updating === `${run.agentId}:advisorToRun`}
                              onChange={event => void updateAdvisorToRun(run.agentId, event.target.value === 'advisor')}
                              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500/20"
                            >
                              <option value="standard">Standard</option>
                              <option value="advisor">Advisor to Run</option>
                            </select>
                          </div>
                        )}
                      </td>
                      <td className="px-4 md:px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={run.assignedTo ?? ''}
                          disabled={updating === run.agentId}
                          onChange={event => void updateAssignedTo(run.agentId, event.target.value)}
                          className="w-32 lg:w-40 rounded-lg border border-slate-200 bg-white px-2 py-1 md:px-2.5 md:py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        >
                          <option value="">Unassigned</option>
                          {reviewers.map(reviewer => (
                            <option key={reviewer.id} value={reviewer.name}>{reviewer.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 md:px-5 py-3">
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
                      <td className="px-4 md:px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <Badge
                          color={run.clientReleased ? 'green' : 'slate'}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          {run.clientReleased ? (
                            <>
                              <Eye className="w-3 h-3 text-emerald-600" />
                              <span>Released {run.clientReleasedAt ? `· ${formatDate(run.clientReleasedAt)}` : ''}</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 text-slate-400" />
                              <span>Not Released</span>
                            </>
                          )}
                        </Badge>
                      </td>
                      <td className="px-4 md:px-5 py-3 text-slate-500">
                        {formatDate(run.runAt)}
                      </td>
                      <td className="px-4 md:px-5 py-3" onClick={(e) => e.stopPropagation()}>
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
                              'inline-flex items-center gap-1 text-xs font-medium px-2 py-1 md:px-2.5 md:py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors',
                            )}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {updating === run.agentId ? 'Saving…' : 'Mark Approved'}
                          </button>
                        )}
                        {run.status === 'approved' && (
                          <button
                            type="button"
                            disabled={updating === run.agentId}
                            onClick={() => void updateStatus(run.agentId, 'in_review')}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 md:px-2.5 md:py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                            Revert to Review
                          </button>
                        )}
                        {run.status === 'approved' && !run.clientReleased && (
                          <button
                            type="button"
                            disabled={updating === run.agentId}
                            onClick={() => void updateClientRelease(run.agentId, true)}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 md:px-2.5 md:py-1.5 rounded-lg border border-cantara-gold/30 bg-[#CAA15F]/10 text-cantara-navy hover:bg-[#CAA15F]/20 transition-colors disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5 text-cantara-gold" />
                            Release to Client
                          </button>
                        )}
                        {run.clientReleased && (
                          <button
                            type="button"
                            disabled={updating === run.agentId}
                            onClick={() => void updateClientRelease(run.agentId, false)}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 md:px-2.5 md:py-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-colors disabled:opacity-50 group"
                          >
                            <Lock className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-500 transition-colors" />
                            Unrelease
                          </button>
                        )}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
