'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  FileText,
  AlertCircle,
  Send,
  Eye,
  EyeOff,
  RotateCcw,
  Lock,
  ExternalLink,
  Link2,
  Search,
  User,
  Sparkles,
  HelpCircle,
  FileCheck2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Badge, Button, Card, Input, cn } from '@/components/ui'
import { getAdminEmail } from '@/lib/store'
import type { AgentReviewer, AgentRunRecord, AgentRunStatus } from '@/app/api/agent-runs/route'
import { isCraigReviewer, isAssignedReviewer, type AssigneeApprovalStatus, type CraigApprovalStatus } from '@/lib/agent-approval-workflow'

const STATUS_META: Record<AgentRunStatus, { label: string; color: 'gray' | 'blue' | 'slate' | 'gold' | 'green' | 'red'; icon: typeof Bot }> = {
  not_started: { label: 'Not run yet', color: 'gray', icon: Clock },
  docs_missing: { label: 'Docs missing', color: 'red', icon: AlertCircle },
  advisor_to_run: { label: 'Advisor to run', color: 'blue', icon: Bot },
  docs_uploaded: { label: 'Ready to run', color: 'blue', icon: FileText },
  partial_docs: { label: 'Partial docs', color: 'slate', icon: FileText },
  in_review: { label: 'In review', color: 'gold', icon: Bot },
  approved: { label: 'Final approved', color: 'green', icon: CheckCircle2 },
}

type ApprovalAction = 'assignee_approve' | 'craig_approve' | 'craig_request_changes' | 'save_feedback_doc' | 'revert_review'

type FilterTabKey = 'all' | 'needs_assignee' | 'needs_craig' | 'changes_requested' | 'approved' | 'released' | 'not_run'

const STATUS_GUIDE_STORAGE_KEY = 'cantara.agentStatus.statusGuideDismissed'

interface WorkflowStageGuide {
  stepNumber: number
  title: string
  role: string
  purpose: string
  statuses: {
    label: string
    badgeClass: string
    detail: string
  }[]
}

/** 4-stage approval workflow breakdown mapping directly to the table columns */
const WORKFLOW_STAGES_GUIDE: WorkflowStageGuide[] = [
  {
    stepNumber: 1,
    title: 'Run & Docs',
    role: 'Intake / Specialist',
    purpose: 'Upload required client docs and run the agent to generate initial output.',
    statuses: [
      {
        label: 'Not run / Docs',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        detail: 'No output yet — upload docs or trigger run.',
      },
      {
        label: 'Ready to run',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        detail: 'Required documents uploaded; ready to execute.',
      },
    ],
  },
  {
    stepNumber: 2,
    title: 'Assignee Approval',
    role: 'Assignee (e.g. Gaby)',
    purpose: 'Assigned specialist inspects generated output and marks approval.',
    statuses: [
      {
        label: 'In Review',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        detail: 'Output generated — assignee reviews & marks approved.',
      },
      {
        label: 'Changes Requested',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        detail: 'Craig requested edits via Google Doc — fix & re-approve.',
      },
    ],
  },
  {
    stepNumber: 3,
    title: 'Craig Review',
    role: 'Craig (Executive)',
    purpose: 'Executive sign-off; Craig reviews output, attaches Doc notes, or approves.',
    statuses: [
      {
        label: 'Ready for Craig',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
        detail: 'Assignee approved — Craig reviews & leaves doc link.',
      },
      {
        label: 'Craig Approved',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        detail: 'Final sign-off complete — unlocks Client Release.',
      },
    ],
  },
  {
    stepNumber: 4,
    title: 'Client Release',
    role: 'Portal Access',
    purpose: 'Controls visibility of verified outputs in the client’s portal.',
    statuses: [
      {
        label: 'Locked',
        badgeClass: 'bg-slate-50 text-slate-500 border-slate-200',
        detail: 'Protected — cannot release until Craig approves.',
      },
      {
        label: 'Released',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        detail: 'Live and accessible to the client.',
      },
    ],
  },
]

function readStatusGuideDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STATUS_GUIDE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeStatusGuideDismissed(dismissed: boolean) {
  try {
    if (dismissed) window.localStorage.setItem(STATUS_GUIDE_STORAGE_KEY, '1')
    else window.localStorage.removeItem(STATUS_GUIDE_STORAGE_KEY)
  } catch {
    // ignore private-mode / blocked storage
  }
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
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }
  const [reviewers, setReviewers] = useState<AgentReviewer[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [docDrafts, setDocDrafts] = useState<Record<string, string>>({})
  const [savedDocsFeedback, setSavedDocsFeedback] = useState<Record<string, boolean>>({})

  // Filtering and search state
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTabKey>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all')
  const [showStatusGuide, setShowStatusGuide] = useState(true)
  const [guideHydrated, setGuideHydrated] = useState(false)
  const [canActAsCraig, setCanActAsCraig] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')

  useEffect(() => {
    setShowStatusGuide(!readStatusGuideDismissed())
    setGuideHydrated(true)
    const email = getAdminEmail()
    setAdminEmail(email)
    setCanActAsCraig(isCraigReviewer(email))
  }, [])

  const dismissStatusGuide = () => {
    writeStatusGuideDismissed(true)
    setShowStatusGuide(false)
  }

  const restoreStatusGuide = () => {
    writeStatusGuideDismissed(false)
    setShowStatusGuide(true)
  }

  const assigneeOptions = useMemo(() => {
    const byName = new Map(reviewers.map((r) => [r.name, r]))
    // Preserve any legacy assigned names that aren't in the current ADMIN list
    for (const run of runs) {
      const name = run.assignedTo?.trim()
      if (name && !byName.has(name)) {
        byName.set(name, { id: `legacy:${name}`, name, email: '' })
      }
    }
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [reviewers, runs])

  const canApproveAsAssignee = useCallback(
    (assignedTo: string | null | undefined) => isAssignedReviewer(adminEmail, assignedTo, reviewers),
    [adminEmail, reviewers],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/agent-runs?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const nextRuns = (data.runs ?? []) as AgentRunRecord[]
      setRuns(nextRuns)
      setReviewers(data.reviewers ?? [])
      setDocDrafts(Object.fromEntries(nextRuns.map((run) => [run.agentId, run.feedbackDocUrl ?? ''])))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent runs')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  const patchRun = async (agentId: string, body: Record<string, unknown>, updatingKey = agentId) => {
    setUpdating(updatingKey)
    try {
      const res = await fetch('/api/agent-runs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, agentId, ...body }),
      })
      if (!res.ok) throw new Error(await res.text())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdating(null)
    }
  }

  const runApprovalAction = async (agentId: string, action: ApprovalAction, feedbackDocUrl?: string) => {
    await patchRun(agentId, { action, feedbackDocUrl })
    if (action === 'save_feedback_doc') {
      setSavedDocsFeedback((prev) => ({ ...prev, [agentId]: true }))
      setTimeout(() => {
        setSavedDocsFeedback((prev) => ({ ...prev, [agentId]: false }))
      }, 2500)
    }
  }

  const updateClientRelease = async (agentId: string, clientReleased: boolean) => {
    await patchRun(agentId, { clientReleased })
  }

  const updateFacilityReviewMode = async (agentId: string, facilityReviewMode: '360' | 'advisor') => {
    await patchRun(agentId, { facilityReviewMode }, `${agentId}:mode`)
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
    await patchRun(agentId, { advisorToRun }, `${agentId}:advisorToRun`)
  }

  const updateAssignedTo = async (agentId: string, assignedTo: string) => {
    await patchRun(agentId, { assignedTo })
  }

  // Filter computation
  const counts = useMemo(() => {
    return {
      all: runs.length,
      needs_assignee: runs.filter((r) => r.hasRun && r.assigneeStatus === 'in_review' && r.craigStatus !== 'changes_requested').length,
      changes_requested: runs.filter((r) => r.craigStatus === 'changes_requested').length,
      needs_craig: runs.filter((r) => r.craigStatus === 'in_review').length,
      approved: runs.filter((r) => r.craigStatus === 'approved' || r.status === 'approved').length,
      released: runs.filter((r) => r.clientReleased).length,
      not_run: runs.filter((r) => !r.hasRun).length,
      unreleased_approved: runs.filter((r) => (r.craigStatus === 'approved' || r.status === 'approved') && !r.clientReleased).length,
    }
  }, [runs])

  const filteredRuns = useMemo(() => {
    return runs.filter((run) => {
      // 1. Tab filter
      if (activeFilterTab === 'needs_assignee') {
        if (!run.hasRun || run.assigneeStatus !== 'in_review' || run.craigStatus === 'changes_requested') return false
      } else if (activeFilterTab === 'changes_requested') {
        if (run.craigStatus !== 'changes_requested') return false
      } else if (activeFilterTab === 'needs_craig') {
        if (run.craigStatus !== 'in_review') return false
      } else if (activeFilterTab === 'approved') {
        if (run.craigStatus !== 'approved' && run.status !== 'approved') return false
      } else if (activeFilterTab === 'released') {
        if (!run.clientReleased) return false
      } else if (activeFilterTab === 'not_run') {
        if (run.hasRun) return false
      }

      // 2. Assignee filter
      if (selectedAssignee !== 'all') {
        if (selectedAssignee === 'unassigned') {
          if (run.assignedTo) return false
        } else if (run.assignedTo !== selectedAssignee) {
          return false
        }
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchName = run.label.toLowerCase().includes(query)
        const matchCategory = run.category.toLowerCase().includes(query)
        const matchAssignee = (run.assignedTo ?? '').toLowerCase().includes(query)
        if (!matchName && !matchCategory && !matchAssignee) return false
      }

      return true
    })
  }, [runs, activeFilterTab, selectedAssignee, searchQuery])

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-[#CAA15F]" />
        <p className="text-xs font-medium text-slate-500">Loading Agent Approval Status...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Top Header & Actions ──────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-[#21263C]">Agent Status & Approvals</h2>
            {guideHydrated && (
              <button
                type="button"
                onClick={() => (showStatusGuide ? dismissStatusGuide() : restoreStatusGuide())}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border',
                  showStatusGuide
                    ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    : 'bg-[#F4F0ED] text-[#21263C] border-[#CAA15F]/40 hover:border-[#CAA15F] hover:bg-[#EAE4DC] shadow-2xs',
                )}
                title={showStatusGuide ? 'Hide approval workflow guide' : 'Show approval workflow guide'}
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#CAA15F]" />
                <span>{showStatusGuide ? 'Hide Workflow Guide' : 'How Approvals Work'}</span>
                {showStatusGuide ? (
                  <ChevronUp className="w-3 h-3 text-slate-400" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                )}
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Read left → right: Run, Assignee approval, Craig review, then Client release.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {counts.unreleased_approved > 0 && (
            <button
              onClick={() => void releaseAllApproved()}
              disabled={updating === 'release-all'}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-[#21263C] text-[#F1E6BB] hover:opacity-95 transition-all shadow-sm disabled:opacity-50"
            >
              {updating === 'release-all' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#CAA15F]" />
                  Releasing {counts.unreleased_approved}...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 text-[#CAA15F]" />
                  Release All Approved ({counts.unreleased_approved})
                </>
              )}
            </button>
          )}
          <Button variant="outline" size="sm" onClick={() => void load()} className="text-xs border-slate-200 text-slate-700 bg-white hover:bg-slate-50">
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Polished Executive Workflow & Status Guide ─────────────────────── */}
      {guideHydrated && showStatusGuide && (
        <div className="rounded-2xl border border-[#CAA15F]/30 bg-gradient-to-br from-[#FCFAF7] via-white to-[#F9F7F3] p-4 sm:p-5 shadow-xs transition-all">
          {/* Header */}
          <div className="flex items-start sm:items-center justify-between gap-3 pb-3 mb-3.5 border-b border-slate-200/70">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#21263C] text-[#CAA15F] flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-[#21263C] flex items-center gap-2 flex-wrap">
                  <span>How the 4-Stage Approval Process Works</span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#CAA15F]/15 text-[#8C6B2D] border border-[#CAA15F]/20">
                    Left → Right Sequential Flow
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Badges correspond directly to the 4 workflow columns in the table below.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={dismissStatusGuide}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-700 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
              aria-label="Hide status guide"
              title="Hide guide (you can re-open it anytime from the top bar)"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Hide Guide</span>
            </button>
          </div>

          {/* 4 Sequential Stage Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {WORKFLOW_STAGES_GUIDE.map((stage) => (
              <div
                key={stage.stepNumber}
                className="relative rounded-xl border border-slate-200/85 bg-white/95 p-3.5 flex flex-col justify-between hover:border-[#CAA15F]/50 hover:shadow-xs transition-all"
              >
                <div>
                  {/* Step number badge & role */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#21263C] text-[#F1E6BB] text-[10px] font-bold uppercase tracking-wider">
                      Stage {stage.stepNumber}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide truncate">
                      {stage.role}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-[#21263C] mb-1">{stage.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-snug mb-3">{stage.purpose}</p>
                </div>

                {/* Status Badges within this stage */}
                <div className="space-y-2 pt-2.5 border-t border-slate-100">
                  {stage.statuses.map((st) => (
                    <div key={st.label} className="flex flex-col gap-1">
                      <div>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap shadow-2xs',
                            st.badgeClass,
                          )}
                        >
                          {st.label}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-slate-600 leading-tight">{st.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <div className="mt-3.5 pt-3 border-t border-slate-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#CAA15F] shrink-0" />
              <span>
                <strong>Review Collaboration:</strong> Craig can paste a Google Doc link directly into any agent row to request revisions from the assignee.
              </span>
            </div>
            <button
              type="button"
              onClick={dismissStatusGuide}
              className="text-[11px] text-[#CAA15F] hover:text-[#8C6B2D] font-semibold hover:underline shrink-0 cursor-pointer"
            >
              Dismiss guide
            </button>
          </div>
        </div>
      )}

      {/* ── Interactive KPI Filter Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { key: 'all', count: counts.all, label: 'All Agents', icon: Bot, color: 'text-slate-800' },
          { key: 'needs_assignee', count: counts.needs_assignee, label: 'Needs Assignee', icon: User, color: 'text-amber-700' },
          { key: 'changes_requested', count: counts.changes_requested, label: 'Changes Req.', icon: AlertCircle, color: 'text-rose-600' },
          { key: 'needs_craig', count: counts.needs_craig, label: 'Needs Craig', icon: Sparkles, color: 'text-blue-700' },
          { key: 'approved', count: counts.approved, label: 'Final Approved', icon: CheckCircle2, color: 'text-emerald-700' },
          { key: 'not_run', count: counts.not_run, label: 'Not Run / Docs', icon: Clock, color: 'text-slate-500' },
        ].map((item) => {
          const Icon = item.icon
          const isSelected = activeFilterTab === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveFilterTab(item.key as FilterTabKey)}
              className={cn(
                'p-3.5 rounded-xl border text-left transition-all relative group cursor-pointer',
                isSelected
                  ? 'border-[#21263C] bg-white ring-2 ring-[#21263C]/15 shadow-sm'
                  : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/50'
              )}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-600">
                  {item.label}
                </span>
                <Icon className={cn('w-3.5 h-3.5', item.color)} />
              </div>
              <p className={cn('text-2xl font-bold tracking-tight', item.color)}>{item.count}</p>
              {isSelected && (
                <span className="absolute bottom-1.5 right-2 w-1.5 h-1.5 rounded-full bg-[#21263C]" />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Search & Filter Controls ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agent name or category..."
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50/50 focus:bg-white focus:outline-none focus:border-[#CAA15F] focus:ring-1 focus:ring-[#CAA15F]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Assignee filter dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-[#CAA15F]"
            >
              <option value="all">All Assignees</option>
              {assigneeOptions.map((rev) => (
                <option key={rev.id} value={rev.name}>
                  Assigned: {rev.name}
                </option>
              ))}
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
        </div>

        {/* Filter status pill & reset */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
          <span className="text-xs text-slate-500">
            Showing <strong className="text-slate-800">{filteredRuns.length}</strong> of {runs.length} agents
          </span>
          {(activeFilterTab !== 'all' || selectedAssignee !== 'all' || searchQuery.trim()) && (
            <button
              onClick={() => {
                setActiveFilterTab('all')
                setSelectedAssignee('all')
                setSearchQuery('')
              }}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Mobile / Small Screens View ──────────────────────────────────────── */}
      <div className="space-y-4 lg:hidden">
        {filteredRuns.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-400">
            No agents found matching the selected filters.
          </Card>
        ) : (
          filteredRuns.map((run) => (
            <AgentStatusCard
              key={run.agentKey}
              run={run}
              reviewers={assigneeOptions}
              updating={updating}
              docDraft={docDrafts[run.agentId] ?? ''}
              onDocDraftChange={(value) => setDocDrafts((prev) => ({ ...prev, [run.agentId]: value }))}
              formatDate={formatDate}
              onOpenAgent={onOpenAgent}
              onAssign={(value) => void updateAssignedTo(run.agentId, value)}
              onFacilityMode={(value) => void updateFacilityReviewMode(run.agentId, value)}
              onAdvisorToRun={(value) => void updateAdvisorToRun(run.agentId, value)}
              onAction={(action, url) => void runApprovalAction(run.agentId, action, url)}
              onRelease={(released) => void updateClientRelease(run.agentId, released)}
              canActAsCraig={canActAsCraig}
              canActAsAssignee={canApproveAsAssignee(run.assignedTo)}
            />
          ))
        )}
      </div>

      {/* ── Desktop Comprehensive Table ─────────────────────────────────────── */}
      <Card className="overflow-hidden hidden lg:block border-slate-200 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1380px] text-sm">
            <thead className="bg-slate-50/90 text-xs border-b border-slate-200 sticky top-0 z-10 backdrop-blur-xs">
              <tr>
                {/* Agent */}
                <th className="text-left px-4 py-3.5 font-bold text-slate-700 w-[270px]">
                  Agent
                </th>

                {/* Assigned To */}
                <th className="text-left px-3 py-3.5 font-bold text-slate-700 w-[160px]">
                  Assigned To
                </th>

                {/* Step 1: Run & Docs */}
                <th className="text-left px-3 py-3.5 font-bold text-slate-700 w-[185px]">
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                      1
                    </span>
                    <span>Run & Docs</span>
                  </div>
                </th>

                {/* Step 2: Assignee Approval */}
                <th className="text-left px-3 py-3.5 font-bold text-slate-700 w-[220px]">
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-100 text-[10px] font-bold text-amber-900 border border-amber-300">
                      2
                    </span>
                    <span>Assignee Approval</span>
                  </div>
                  <span className="text-[10px] font-normal text-slate-400 block mt-0.5">Assigned reviewer sign-off</span>
                </th>

                {/* Step 3: Craig Review */}
                <th className="text-left px-3 py-3.5 font-bold text-slate-700 w-[330px]">
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-[10px] font-bold text-blue-900 border border-blue-300">
                      3
                    </span>
                    <span>Craig Review</span>
                  </div>
                  <span className="text-[10px] font-normal text-slate-400 block mt-0.5">Final sign-off & Google Doc feedback</span>
                </th>

                {/* Step 4: Client Release */}
                <th className="text-left px-3 py-3.5 font-bold text-slate-700 w-[170px]">
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-900 border border-emerald-300">
                      4
                    </span>
                    <span>Client Release</span>
                  </div>
                  <span className="text-[10px] font-normal text-slate-400 block mt-0.5">Portal access control</span>
                </th>

                {/* Output Actions */}
                <th className="text-right px-4 py-3.5 font-bold text-slate-700 w-[110px]">
                  Output
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRuns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-slate-400 text-sm">
                    No agents match your active search or filters.
                  </td>
                </tr>
              ) : (
                filteredRuns.map((run, idx) => {
                  const showCategory = idx === 0 || filteredRuns[idx - 1]?.category !== run.category
                  const busy = updating === run.agentId
                  const isCraigApproved = run.craigStatus === 'approved' || run.status === 'approved'

                  return (
                    <Fragment key={run.agentKey}>
                      {showCategory && (
                        <tr className="bg-slate-50/50">
                          <td
                            colSpan={7}
                            className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 border-t border-slate-200/60"
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#CAA15F]" />
                              {run.category}
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr className="hover:bg-slate-50/80 transition-colors group">
                        {/* ── 1. Agent Name & Mode ──────────────────────────── */}
                        <td className="px-4 py-3.5 align-top">
                          <p className="font-semibold text-slate-900 leading-snug">{run.label}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{run.category}</p>

                          {/* Specific Agent Configuration Options */}
                          {run.agentKey === 'facilityReview' && (
                            <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[10px] text-slate-500 font-medium">Mode:</span>
                              <select
                                value={run.facilityReviewMode ?? '360'}
                                disabled={updating === `${run.agentId}:mode`}
                                onChange={(event) => void updateFacilityReviewMode(run.agentId, event.target.value as '360' | 'advisor')}
                                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 shadow-2xs"
                              >
                                <option value="360">360 Review</option>
                                <option value="advisor">Advisor Review</option>
                              </select>
                            </div>
                          )}
                          {run.agentKey === 'legalEntitySearch' && (
                            <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[10px] text-slate-500 font-medium">Type:</span>
                              <select
                                value={run.advisorToRun ? 'advisor' : 'standard'}
                                disabled={updating === `${run.agentId}:advisorToRun`}
                                onChange={(event) => void updateAdvisorToRun(run.agentId, event.target.value === 'advisor')}
                                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 shadow-2xs"
                              >
                                <option value="standard">Standard</option>
                                <option value="advisor">Advisor to Run</option>
                              </select>
                            </div>
                          )}
                        </td>

                        {/* ── 2. Assigned To ───────────────────────────────── */}
                        <td className="px-3 py-3.5 align-top">
                          <div className="relative">
                            <select
                              value={run.assignedTo ?? ''}
                              disabled={busy}
                              onChange={(event) => void updateAssignedTo(run.agentId, event.target.value)}
                              className={cn(
                                'w-full rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors appearance-none pr-6 cursor-pointer',
                                run.assignedTo
                                  ? 'border-slate-200 bg-white text-slate-800'
                                  : 'border-dashed border-slate-300 bg-slate-50/70 text-slate-400 italic'
                              )}
                            >
                              <option value="">Unassigned</option>
                              {assigneeOptions.map((reviewer) => (
                                <option key={reviewer.id} value={reviewer.name}>
                                  {reviewer.email ? `${reviewer.name} (${reviewer.email})` : reviewer.name}
                                </option>
                              ))}
                            </select>
                            <User className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                          </div>
                        </td>

                        {/* ── 3. Step 1: Run & Docs ────────────────────────── */}
                        <td className="px-3 py-3.5 align-top whitespace-nowrap">
                          {!run.hasRun ? (
                            <div className="space-y-1">
                              {run.status === 'docs_missing' ? (
                                <MissingDocsBadge
                                  missingDocs={run.missingDocs}
                                  onOpenDocuments={onOpenAgent ? () => onOpenAgent('documents') : undefined}
                                />
                              ) : run.status === 'partial_docs' ? (
                                <MissingDocsBadge
                                  missingDocs={run.missingDocs}
                                  label="Partial docs"
                                  color="slate"
                                  onOpenDocuments={onOpenAgent ? () => onOpenAgent('documents') : undefined}
                                />
                              ) : run.status === 'docs_uploaded' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                  <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                  Partial docs
                                </span>
                              ) : run.status === 'advisor_to_run' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  <Bot className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  Advisor to run
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200">
                                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  Not run yet
                                </span>
                              )}
                              <p className="text-[10px] text-slate-400">Step 1 Pending</p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                Run Completed
                              </span>
                              <p className="text-[10px] text-slate-500">
                                Run: {formatDate(run.runAt)}
                              </p>
                            </div>
                          )}
                        </td>

                        {/* ── 4. Step 2: Assignee Approval ─────────────────── */}
                        <td className="px-3 py-3.5 align-top">
                          {!run.hasRun ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-normal text-slate-400 bg-slate-50 border border-dashed border-slate-200">
                                <Clock className="w-3 h-3 text-slate-300" />
                                Waiting for run
                              </span>
                              <p className="text-[10px] text-slate-400">Awaiting Step 1</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {/* If Craig requested changes */}
                              {run.craigStatus === 'changes_requested' ? (
                                <div className="space-y-1.5 bg-rose-50/70 border border-rose-200 rounded-lg p-2">
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700">
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                    Changes Requested
                                  </span>
                                  {run.feedbackDocUrl && (
                                    <a
                                      href={run.feedbackDocUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline bg-white px-2 py-0.5 rounded border border-rose-200"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      Craig's Feedback Doc
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    disabled={busy || !canApproveAsAssignee(run.assignedTo)}
                                    onClick={() => void runApprovalAction(run.agentId, 'assignee_approve')}
                                    title={
                                      canApproveAsAssignee(run.assignedTo)
                                        ? 'Mark approved again after changes'
                                        : run.assignedTo
                                          ? `Only ${run.assignedTo} can approve`
                                          : 'Assign an advisor before approving'
                                    }
                                    className="w-full mt-1 flex items-center justify-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {busy ? 'Saving…' : 'Mark Approved Again'}
                                  </button>
                                  {!canApproveAsAssignee(run.assignedTo) && (
                                    <p className="text-[10px] text-slate-400 italic">
                                      {run.assignedTo ? `Only ${run.assignedTo} can approve` : 'Assign an advisor first'}
                                    </p>
                                  )}
                                </div>
                              ) : run.assigneeStatus === 'in_review' ? (
                                <div className="space-y-1.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    In Review
                                  </span>
                                  <button
                                    type="button"
                                    disabled={busy || !canApproveAsAssignee(run.assignedTo)}
                                    onClick={() => void runApprovalAction(run.agentId, 'assignee_approve')}
                                    title={
                                      canApproveAsAssignee(run.assignedTo)
                                        ? 'Approve and send to Craig'
                                        : run.assignedTo
                                          ? `Only ${run.assignedTo} can approve`
                                          : 'Assign an advisor before approving'
                                    }
                                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {busy ? 'Saving…' : 'Mark Approved'}
                                  </button>
                                  {!canApproveAsAssignee(run.assignedTo) && (
                                    <p className="text-[10px] text-slate-400 italic">
                                      {run.assignedTo ? `Only ${run.assignedTo} can approve` : 'Assign an advisor first'}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-0.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Approved
                                  </span>
                                  <p className="text-[10px] text-slate-400">Passed to Craig</p>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* ── 5. Step 3: Craig Review & Google Doc ─────────── */}
                        <td className="px-3 py-3.5 align-top">
                          {!run.hasRun || run.assigneeStatus === 'waiting' ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-normal text-slate-400 bg-slate-50 border border-dashed border-slate-200">
                                <Clock className="w-3 h-3 text-slate-300" />
                                Waiting for Assignee
                              </span>
                              <p className="text-[10px] text-slate-400">Awaiting Step 2 sign-off</p>
                            </div>
                          ) : run.assigneeStatus === 'in_review' && run.craigStatus !== 'changes_requested' ? (
                            <div className="space-y-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-normal text-slate-400 bg-slate-50 border border-dashed border-slate-200">
                                <Clock className="w-3 h-3 text-slate-400" />
                                Waiting for Assignee
                              </span>
                              <p className="text-[10px] text-slate-400">
                                {run.assignedTo ? `${run.assignedTo} reviewing` : 'Assignee reviewing'}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2 max-w-[320px]">
                              {/* Status badge */}
                              {run.craigStatus === 'approved' ? (
                                <div className="flex items-center justify-between gap-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Craig Approved
                                  </span>
                                  {canActAsCraig && (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => void runApprovalAction(run.agentId, 'revert_review')}
                                      className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                                    >
                                      Reopen
                                    </button>
                                  )}
                                </div>
                              ) : run.craigStatus === 'changes_requested' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                                  <AlertCircle className="w-3 h-3 text-rose-600" />
                                  Changes Requested
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                                  <Sparkles className="w-3 h-3 text-amber-700" />
                                  Ready for Craig Review
                                </span>
                              )}

                              {!canActAsCraig && (
                                <p className="text-[10px] text-slate-400 italic">Only Craig can act in this column</p>
                              )}

                              {/* Google Doc link input */}
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <div className="relative flex-1">
                                    <input
                                      type="text"
                                      value={docDrafts[run.agentId] ?? ''}
                                      onChange={(e) => setDocDrafts((prev) => ({ ...prev, [run.agentId]: e.target.value }))}
                                      placeholder="Google Doc link for feedback"
                                      disabled={!canActAsCraig || busy}
                                      readOnly={!canActAsCraig}
                                      className="w-full text-xs h-7 px-2 pr-6 rounded-md border border-slate-200 bg-white focus:outline-none focus:border-[#CAA15F] disabled:bg-slate-50 disabled:text-slate-500"
                                    />
                                    <Link2 className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                  </div>

                                  <button
                                    type="button"
                                    disabled={!canActAsCraig || busy || !docDrafts[run.agentId]?.trim()}
                                    title={canActAsCraig ? 'Save Google Doc link' : 'Only Craig can save feedback docs'}
                                    onClick={() => void runApprovalAction(run.agentId, 'save_feedback_doc', docDrafts[run.agentId])}
                                    className="shrink-0 h-7 px-2 text-[11px] font-medium rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                  >
                                    {savedDocsFeedback[run.agentId] ? 'Saved ✓' : 'Save'}
                                  </button>

                                  {run.feedbackDocUrl && (
                                    <a
                                      href={run.feedbackDocUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="shrink-0 h-7 px-2 inline-flex items-center gap-1 text-[11px] font-medium rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                                      title="Open feedback document in new tab"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      Doc
                                    </a>
                                  )}
                                </div>
                              </div>

                              {/* Action buttons */}
                              {run.craigStatus !== 'approved' && (
                                <div className="flex items-center gap-1.5 pt-0.5">
                                  <button
                                    type="button"
                                    disabled={!canActAsCraig || busy}
                                    onClick={() => void runApprovalAction(run.agentId, 'craig_request_changes', docDrafts[run.agentId])}
                                    className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    title={canActAsCraig ? 'Send back to Assignee with the Google Doc notes' : 'Only Craig can request changes'}
                                  >
                                    Request Changes
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!canActAsCraig || busy}
                                    onClick={() => void runApprovalAction(run.agentId, 'craig_approve', docDrafts[run.agentId])}
                                    className="flex-1 inline-flex items-center justify-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[#21263C] text-[#F1E6BB] hover:opacity-90 transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                    title={canActAsCraig ? 'Final approval by Craig' : 'Only Craig can final-approve'}
                                  >
                                    <CheckCircle2 className="w-3 h-3 text-[#CAA15F]" />
                                    Final Approve
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* ── 6. Step 4: Client Release ────────────────────── */}
                        <td className="px-3 py-3.5 align-top">
                          {!isCraigApproved ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-normal text-slate-400 bg-slate-50 border border-slate-200">
                                <Lock className="w-3 h-3 text-slate-400" />
                                Locked
                              </span>
                              <p className="text-[10px] text-slate-400">Requires Craig approval</p>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              {run.clientReleased ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <Eye className="w-3 h-3 text-emerald-600" />
                                    Released to Client
                                  </span>
                                  <p className="text-[10px] text-slate-500">
                                    {formatDate(run.clientReleasedAt)}
                                  </p>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void updateClientRelease(run.agentId, false)}
                                    className="text-[10px] text-slate-400 hover:text-rose-600 transition-colors block underline cursor-pointer"
                                  >
                                    Unrelease
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-600" />
                                    Ready to Release
                                  </span>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void updateClientRelease(run.agentId, true)}
                                    className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-[#21263C] text-[#F1E6BB] hover:opacity-90 transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
                                  >
                                    <Send className="w-3 h-3 text-[#CAA15F]" />
                                    Release
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* ── 7. Output Actions ────────────────────────────── */}
                        <td className="px-4 py-3.5 align-top text-right">
                          {run.hasRun ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (run.tabKey && onOpenAgent) onOpenAgent(run.tabKey)
                              }}
                              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-2xs cursor-pointer"
                              title="Review agent output report"
                            >
                              <ExternalLink className="w-3 h-3 text-[#CAA15F]" />
                              Review
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No output</span>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

function MissingDocsBadge({
  missingDocs,
  label = 'Missing Docs',
  color = 'rose',
  onOpenDocuments,
}: {
  missingDocs?: { id: string; name: string }[]
  label?: string
  color?: 'rose' | 'slate'
  onOpenDocuments?: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const count = missingDocs?.length ?? 0

  // Close when clicking outside if pinned
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setIsPinned(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  if (count === 0) return null

  const isRose = color === 'rose'

  const handleMouseEnter = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    if (isPinned) return
    timerRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 250) // 250ms buffer so user can effortlessly transition cursor into card
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isOpen && isPinned) {
      setIsOpen(false)
      setIsPinned(false)
    } else {
      setIsOpen(true)
      setIsPinned(true)
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shadow-2xs',
          isRose
            ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 hover:border-rose-300'
            : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
        )}
      >
        <AlertCircle className={cn('w-3.5 h-3.5 shrink-0', isRose ? 'text-rose-600' : 'text-slate-500')} />
        <span className="whitespace-nowrap">
          {label} ({count})
        </span>
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full pt-1.5 z-50 w-80 max-w-sm"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-100 text-left cursor-default">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 whitespace-nowrap">
                <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Missing Required Files ({count})</span>
              </div>
              <span className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 whitespace-nowrap shrink-0">
                Action needed
              </span>
            </div>

            {/* Explanation */}
            <p className="text-[11px] text-slate-500 mb-2 leading-relaxed">
              The following files are required before this agent can be executed:
            </p>

            {/* List of files */}
            <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {missingDocs?.map((doc, idx) => (
                <li
                  key={doc.id || idx}
                  className="flex items-start gap-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-800 border border-slate-100/80"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                  <span className="font-medium leading-snug">{doc.name}</span>
                </li>
              ))}
            </ul>

            {/* Link to Documents tab */}
            {onOpenDocuments && (
              <div className="mt-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false)
                    setIsPinned(false)
                    onOpenDocuments()
                  }}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg bg-[#21263C] text-[#F1E6BB] hover:opacity-90 transition-opacity cursor-pointer shadow-2xs"
                >
                  <span>Upload in Documents Tab</span>
                  <ExternalLink className="w-3 h-3 text-[#CAA15F]" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AgentStatusCard({
  run,
  reviewers,
  updating,
  docDraft,
  onDocDraftChange,
  formatDate,
  onOpenAgent,
  onAssign,
  onFacilityMode,
  onAdvisorToRun,
  onAction,
  onRelease,
  canActAsCraig,
  canActAsAssignee,
}: {
  run: AgentRunRecord
  reviewers: AgentReviewer[]
  updating: string | null
  docDraft: string
  onDocDraftChange: (value: string) => void
  formatDate: (value: string | null | undefined) => string
  onOpenAgent?: (tabKey: string) => void
  onAssign: (value: string) => void
  onFacilityMode: (value: '360' | 'advisor') => void
  onAdvisorToRun: (value: boolean) => void
  onAction: (action: ApprovalAction, url?: string) => void
  onRelease: (released: boolean) => void
  canActAsCraig: boolean
  canActAsAssignee: boolean
}) {
  const busy = updating === run.agentId
  const isCraigApproved = run.craigStatus === 'approved' || run.status === 'approved'

  return (
    <Card className="p-4 space-y-4 border-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#CAA15F]">{run.category}</span>
          <h3 className="font-bold text-slate-900 text-sm mt-0.5">{run.label}</h3>
        </div>
        {run.hasRun && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
            onClick={() => run.tabKey && onOpenAgent?.(run.tabKey)}
          >
            <ExternalLink className="w-3 h-3 text-[#CAA15F]" />
            Review Output
          </button>
        )}
      </div>

      {/* Assignee Selection */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
        <label className="text-xs text-slate-500 font-medium flex items-center gap-1">
          <User className="w-3.5 h-3.5 text-slate-400" />
          Assigned to:
        </label>
        <select
          value={run.assignedTo ?? ''}
          disabled={busy}
          onChange={(e) => onAssign(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700"
        >
          <option value="">Unassigned</option>
          {reviewers.map((reviewer) => (
            <option key={reviewer.id} value={reviewer.name}>
              {reviewer.email ? `${reviewer.name} (${reviewer.email})` : reviewer.name}
            </option>
          ))}
        </select>
      </div>

      {/* Specific Configuration Controls */}
      {run.agentKey === 'facilityReview' && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-500 font-medium">Facility mode:</span>
          <select
            value={run.facilityReviewMode ?? '360'}
            disabled={busy}
            onChange={(e) => onFacilityMode(e.target.value as '360' | 'advisor')}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
          >
            <option value="360">360 Review</option>
            <option value="advisor">Advisor Review</option>
          </select>
        </div>
      )}

      {run.agentKey === 'legalEntitySearch' && (
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-500 font-medium">Manual:</span>
          <select
            value={run.advisorToRun ? 'advisor' : 'standard'}
            disabled={busy}
            onChange={(e) => onAdvisorToRun(e.target.value === 'advisor')}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
          >
            <option value="standard">Standard</option>
            <option value="advisor">Advisor to Run</option>
          </select>
        </div>
      )}

      {/* Step 1: Run & Docs */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-slate-200 text-[10px] flex items-center justify-center font-bold">1</span>
            Run & Docs
          </span>
          {run.hasRun ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="w-3 h-3" />
              Completed {run.runAt ? `· ${formatDate(run.runAt)}` : ''}
            </span>
          ) : run.status === 'docs_missing' ? (
            <MissingDocsBadge
              missingDocs={run.missingDocs}
              onOpenDocuments={onOpenAgent ? () => onOpenAgent('documents') : undefined}
            />
          ) : run.status === 'partial_docs' ? (
            <MissingDocsBadge
              missingDocs={run.missingDocs}
              label="Partial docs"
              color="slate"
              onOpenDocuments={onOpenAgent ? () => onOpenAgent('documents') : undefined}
            />
          ) : (
            <span className="text-xs font-medium text-slate-500">Ready to run</span>
          )}
        </div>
      </div>

      {/* Step 2: Assignee Approval */}
      <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-amber-200 text-[10px] flex items-center justify-center font-bold text-amber-900">2</span>
            Assignee Approval
          </span>
          {!run.hasRun ? (
            <span className="text-xs text-slate-400">Waiting for run</span>
          ) : run.assigneeStatus === 'approved' ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="w-3 h-3" />
              Approved
            </span>
          ) : run.craigStatus === 'changes_requested' ? (
            <span className="text-xs font-bold text-rose-700">Changes Requested</span>
          ) : (
            <span className="text-xs font-semibold text-amber-800">In Review</span>
          )}
        </div>

        {run.hasRun && run.craigStatus === 'changes_requested' && (
          <div className="space-y-1.5 pt-1">
            {run.feedbackDocUrl && (
              <a
                href={run.feedbackDocUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 underline"
              >
                <ExternalLink className="w-3 h-3" /> Open Craig's Feedback Doc
              </a>
            )}
            <button
              type="button"
              disabled={busy || !canActAsAssignee}
              onClick={() => onAction('assignee_approve')}
              title={
                canActAsAssignee
                  ? 'Mark approved again after changes'
                  : run.assignedTo
                    ? `Only ${run.assignedTo} can approve`
                    : 'Assign an advisor before approving'
              }
              className="w-full inline-flex items-center justify-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark Approved Again
            </button>
            {!canActAsAssignee && (
              <p className="text-[10px] text-slate-400 italic">
                {run.assignedTo ? `Only ${run.assignedTo} can approve` : 'Assign an advisor first'}
              </p>
            )}
          </div>
        )}

        {run.hasRun && run.assigneeStatus === 'in_review' && run.craigStatus !== 'changes_requested' && (
          <>
            <button
              type="button"
              disabled={busy || !canActAsAssignee}
              onClick={() => onAction('assignee_approve')}
              title={
                canActAsAssignee
                  ? 'Approve and send to Craig'
                  : run.assignedTo
                    ? `Only ${run.assignedTo} can approve`
                    : 'Assign an advisor before approving'
              }
              className="w-full inline-flex items-center justify-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Mark Approved
            </button>
            {!canActAsAssignee && (
              <p className="text-[10px] text-slate-400 italic">
                {run.assignedTo ? `Only ${run.assignedTo} can approve` : 'Assign an advisor first'}
              </p>
            )}
          </>
        )}
      </div>

      {/* Step 3: Craig Review */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-blue-200 text-[10px] flex items-center justify-center font-bold text-blue-900">3</span>
            Craig Review & Notes
          </span>
          {!run.hasRun || run.assigneeStatus !== 'approved' ? (
            <span className="text-xs text-slate-400">Waiting for Assignee</span>
          ) : run.craigStatus === 'approved' ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="w-3 h-3" />
              Craig Approved
            </span>
          ) : run.craigStatus === 'changes_requested' ? (
            <span className="text-xs font-bold text-rose-700">Awaiting Assignee Changes</span>
          ) : (
            <span className="text-xs font-semibold text-blue-800">Ready for Craig</span>
          )}
        </div>

        {run.hasRun && run.assigneeStatus === 'approved' && (
          <div className="space-y-2 pt-1">
            {!canActAsCraig && (
              <p className="text-[10px] text-slate-400 italic">Only Craig can act in this column</p>
            )}
            <div className="flex items-center gap-1.5">
              <Input
                value={docDraft}
                onChange={(e) => onDocDraftChange(e.target.value)}
                placeholder="Google Doc feedback link"
                className="text-xs h-8"
                disabled={!canActAsCraig || busy}
                readOnly={!canActAsCraig}
              />
              <button
                type="button"
                disabled={!canActAsCraig || busy || !docDraft?.trim()}
                onClick={() => onAction('save_feedback_doc', docDraft)}
                className="shrink-0 h-8 px-2 text-xs font-medium rounded-md border border-slate-200 bg-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Save
              </button>
              {run.feedbackDocUrl && (
                <a
                  href={run.feedbackDocUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 h-8 px-2 inline-flex items-center gap-1 text-xs font-medium rounded-md border border-blue-200 bg-blue-50 text-blue-700"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {run.craigStatus !== 'approved' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canActAsCraig || busy}
                  onClick={() => onAction('craig_request_changes', docDraft)}
                  className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-semibold px-2 py-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-900 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Request Changes
                </button>
                <button
                  type="button"
                  disabled={!canActAsCraig || busy}
                  onClick={() => onAction('craig_approve', docDraft)}
                  className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-[#21263C] text-[#F1E6BB] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#CAA15F]" />
                  Final Approve
                </button>
              </div>
            )}
            {run.craigStatus === 'approved' && canActAsCraig && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onAction('revert_review')}
                className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer"
              >
                Reopen review
              </button>
            )}
          </div>
        )}
      </div>

      {/* Step 4: Client Release */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full bg-emerald-200 text-[10px] flex items-center justify-center font-bold text-emerald-900">4</span>
          Client Release
        </span>
        {!isCraigApproved ? (
          <span className="inline-flex items-center gap-1 text-xs text-slate-400">
            <Lock className="w-3 h-3" /> Locked
          </span>
        ) : run.clientReleased ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-700">Released</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => onRelease(false)}
              className="text-xs text-slate-400 hover:text-rose-600 underline cursor-pointer"
            >
              Unrelease
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => onRelease(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-lg bg-[#21263C] text-[#F1E6BB] cursor-pointer"
          >
            <Send className="w-3 h-3 text-[#CAA15F]" /> Release to Client
          </button>
        )}
      </div>
    </Card>
  )
}
