'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  RotateCw,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react'
import { Button, Card, cn } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import InlineEditableMarkdownReport from '@/components/report-export/InlineEditableMarkdownReport'
import { buildBuyerReportHtml } from '@/lib/report-export/build-buyer-report'
import { getStatusBadgeKind, isStatusCell } from '@/lib/report-export/status-cell'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'
import { AdvisorActions, ClientApprovedEmptyState } from '@/components/client-portal/AgentClientPortalFrame'

type BuyerReport = {
  workstream: string
  workstreamLabel: string
  clientName: string
  generatedAt: string
  updatedAt?: string
  markdown: string
}

interface AgentSourceItem {
  key: string
  name: string
  tabKey: string
  required: boolean
  ready: boolean
  note: string
}

interface Props {
  clientId: string
  clientName: string
  workstream: 'ws1' | 'ws2'
  onOpenAgent?: (tabKey: string) => void
  readOnly?: boolean
}

/** Map emoji status indicators to styled badges */
function StatusBadge({ text }: { text: string }) {
  const kind = getStatusBadgeKind(text)
  if (kind === 'green') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        🟢 Green
      </span>
    )
  }
  if (kind === 'yellow') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
        🟡 Yellow
      </span>
    )
  }
  if (kind === 'red') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
        🔴 Red
      </span>
    )
  }
  return <span>{String(text ?? '')}</span>
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-5 border-b-2 border-blue-200 pb-3 text-2xl font-bold tracking-tight text-slate-900">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-3 mt-10 text-lg font-bold tracking-tight text-slate-900 border-b border-slate-200 pb-2">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-6 text-sm font-bold text-slate-800">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mb-2 mt-4 text-sm font-semibold text-slate-700">{children}</h4>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-4 text-sm leading-7 text-slate-700">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-bold text-slate-900">{children}</strong>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-5 list-disc space-y-2 pl-5 text-sm text-slate-700 marker:text-blue-500">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-slate-700 marker:text-blue-500">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-7">{children}</li>
  ),
  hr: () => <hr className="my-8 border-slate-200" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-slate-50">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => {
    const text = String(children ?? '')
    if (isStatusCell(text)) {
      return (
        <td className="border-t border-slate-100 px-4 py-3 align-top">
          <StatusBadge text={text} />
        </td>
      )
    }
    return <td className="border-t border-slate-100 px-4 py-3 align-top text-sm leading-6 text-slate-700">{children}</td>
  },
}

// ── Toast Component ─────────────────────────────────────────────────────────
function StatusToast({
  toast,
  onClose,
}: {
  toast: { message: string; type: 'success' | 'error' | 'info' } | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div
        className={cn(
          'flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium',
          toast.type === 'success' && 'bg-emerald-50 border-emerald-200 text-emerald-900',
          toast.type === 'error' && 'bg-rose-50 border-rose-200 text-rose-900',
          toast.type === 'info' && 'bg-slate-900 border-slate-800 text-white',
        )}
      >
        {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
        {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
        <span>{toast.message}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Delete Confirmation Modal ───────────────────────────────────────────────
function DeleteConfirmModal({
  open,
  title,
  description,
  onClose,
  onConfirm,
  confirmLabel = 'Delete',
  isDeleting = false,
}: {
  open: boolean
  title: string
  description: string
  onClose: () => void
  onConfirm: () => void
  confirmLabel?: string
  isDeleting?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
        </div>
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="px-3.5 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Agent Source Card Row ──────────────────────────────────────────────────
function AgentSourceRow({
  source,
  onOpen,
}: {
  source: AgentSourceItem
  onOpen: (tabKey: string) => void
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all shadow-2xs',
        source.ready ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200/80 bg-white',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                source.ready ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400',
              )}
            >
              <FileText className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-800">{source.name}</p>
                {source.required ? (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                    Required
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    Optional
                  </span>
                )}
                {source.ready ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Ready
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-200">
                    Not generated
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{source.note}</p>

              <p className="text-[11px] text-slate-400 mt-1.5">
                {source.ready
                  ? 'Output generated and ready to be compiled into the buyer report.'
                  : source.required
                  ? 'Not generated yet (required — must be submitted in the roadmap agent before generating).'
                  : 'Not generated yet (optional — buyer report compiles with or without this agent output).'}
              </p>
            </div>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpen(source.tabKey)}
          className="h-8 text-xs gap-1.5 shrink-0 cursor-pointer hover:bg-slate-50"
          title={`Go to ${source.name}`}
        >
          <span>Open Agent</span>
          <ExternalLink className="w-3 h-3 text-slate-400" />
        </Button>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function BuyerReportTab({
  clientId,
  clientName,
  workstream,
  onOpenAgent,
  readOnly = false,
}: Props) {
  const [report, setReport] = useState<BuyerReport | null>(null)
  const [sources, setSources] = useState<AgentSourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roadmapReady, setRoadmapReady] = useState(false)
  const [composingNew, setComposingNew] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [showSourceDrawer, setShowSourceDrawer] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const { provider, setProvider } = useAgentAiProvider()
  const {
    runs,
    historyItems: allHistoryItems,
    activeId: allActiveId,
    setActiveId,
    reload: reloadRuns,
    loading: loadingRuns,
  } = useGenericAgentRuns(clientId, AGENT_RUN_KEYS.buyerReport)

  const runsForWorkstream = useMemo(
    () =>
      runs.filter((run) => {
        const meta = run.metadata as { workstream?: string } | null | undefined
        return (
          meta?.workstream === workstream ||
          (!meta?.workstream && run.report && (run.report as BuyerReport).workstream === workstream)
        )
      }),
    [runs, workstream],
  )

  const historyItems = useMemo(
    () =>
      runsForWorkstream
        .map((run) => allHistoryItems.find((item) => item.id === run.id)!)
        .filter(Boolean),
    [runsForWorkstream, allHistoryItems],
  )

  const activeRun = useMemo(
    () => runsForWorkstream.find((run) => run.id === allActiveId) ?? runsForWorkstream[0] ?? null,
    [runsForWorkstream, allActiveId],
  )

  const activeId = activeRun?.id ?? null
  const wsLabel = workstream === 'ws1' ? 'WS1 — Risk Mitigation' : 'WS2 — Profitability & Growth'

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
  }

  const handleOpenAgent = useCallback(
    (tabKey: string) => {
      if (onOpenAgent) {
        onOpenAgent(tabKey)
      } else {
        window.location.href = `/admin/client/${clientId}?tab=${tabKey}`
      }
    },
    [onOpenAgent, clientId],
  )

  const loadFromApi = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/buyer-report?clientId=${encodeURIComponent(clientId)}&workstream=${workstream}`,
        { cache: 'no-store' },
      )
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      if (!activeRun?.report) {
        setReport(data.report)
      }
      setRoadmapReady(Boolean(data.roadmapReady))
      setSources(data.sources || [])
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load buyer report.')
    } finally {
      setLoading(false)
    }
  }, [clientId, workstream, activeRun])

  useEffect(() => {
    if (loadingRuns || composingNew) return
    if (activeRun?.report) {
      setReport(activeRun.report as BuyerReport)
      setLoading(false)
      void loadFromApi()
      return
    }
    void loadFromApi()
  }, [activeRun, loadingRuns, loadFromApi, composingNew])

  function selectRun(run: AgentRunHistoryItem) {
    setComposingNew(false)
    setActiveId(run.id)
    const full = runs.find((item) => item.id === run.id)
    if (full?.report) setReport(full.report as BuyerReport)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadFromApi()
      showToast('Agent inputs refreshed', 'success')
    } catch {
      showToast('Failed to refresh agent inputs', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const generate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/buyer-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          workstream,
          provider,
          modelId: resolveAgentModelId(provider),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate buyer report.')
      setReport(data.report)
      await saveAgentAnalysisRunClient({
        clientId,
        agentKey: AGENT_RUN_KEYS.buyerReport,
        fileName: `${clientName} — ${wsLabel} Buyer Report`,
        report: data.report,
        markdown: data.report?.markdown,
        metadata: { workstream },
        aiProvider: provider,
        aiModel: resolveAgentModelId(provider),
      })
      setComposingNew(false)
      await reloadRuns({ selectNewest: true })
      showToast('Buyer report generated successfully', 'success')
    } catch (err: any) {
      setError(err?.message ?? 'Failed to generate buyer report.')
      showToast(err?.message ?? 'Failed to generate buyer report.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handleDeleteReport = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(
        `/api/buyer-report?clientId=${encodeURIComponent(clientId)}&workstream=${workstream}`,
        { method: 'DELETE' },
      )
      if (!res.ok) throw new Error('Failed to delete report')
      setReport(null)
      setError(null)
      setActiveId(null)
      setComposingNew(false)
      await reloadRuns()
      setDeleteModalOpen(false)
      showToast('Buyer report deleted', 'success')
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete report', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const html = useMemo(() => (report ? buildBuyerReportHtml(report) : ''), [report])

  const requiredSources = useMemo(() => sources.filter((s) => s.required), [sources])
  const optionalSources = useMemo(() => sources.filter((s) => !s.required), [sources])
  const optionalReadyCount = useMemo(() => optionalSources.filter((s) => s.ready).length, [optionalSources])
  const totalReadyCount = useMemo(() => sources.filter((s) => s.ready).length, [sources])

  if (loading || loadingRuns) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    )
  }

  if (readOnly && !report) {
    return <ClientApprovedEmptyState agentName={`${wsLabel} Buyer Report`} />
  }

  // ── Results / Report View ─────────────────────────────────────────────────
  if (report && !composingNew) {
    return (
      <div className="space-y-6">
        {/* Unified Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
              Buyer Report
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {clientName} &mdash; {wsLabel} &mdash; Generated{' '}
              {new Date(report.generatedAt || Date.now()).toLocaleString()}
            </p>
          </div>
          <AdvisorActions className="flex items-center gap-2.5 flex-wrap">
            <ExportReportButton
              html={html}
              fileName={`${clientName} - ${wsLabel} Buyer Report.pdf`}
              label="Export PDF"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={generating || !roadmapReady}
              onClick={generate}
              className="h-8 text-xs cursor-pointer"
            >
              <RefreshCw className={cn('w-3.5 h-3.5 mr-1', generating && 'animate-spin')} />
              Regenerate
            </Button>
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteModalOpen(true)}
                className="h-8 text-xs text-rose-600 hover:bg-rose-50 border-slate-200 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete
              </Button>
            )}
            {!readOnly && (
              <Button
                type="button"
                size="sm"
                onClick={() => setComposingNew(true)}
                className="h-8 text-xs cursor-pointer bg-slate-900 hover:bg-slate-800 text-white"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                New Analysis
              </Button>
            )}
          </AdvisorActions>
        </div>

        {!readOnly && (
          <AgentRunToolbar
            provider={provider}
            onProviderChange={setProvider}
            disabled={generating}
            historyItems={historyItems}
            activeId={activeId}
            onSelectRun={selectRun}
            activeProvider={activeRun?.aiProvider}
            activeModel={activeRun?.aiModel}
            activeVersion={activeRun?.version}
          />
        )}

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-4 py-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            {error}
          </div>
        )}

        {/* Source Inputs Summary Accordion */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowSourceDrawer((prev) => !prev)}
              className="flex items-center gap-2 text-xs font-semibold text-slate-800 hover:text-slate-900 cursor-pointer"
            >
              {showSourceDrawer ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              )}
              <span>Synthesized Agent Context</span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {totalReadyCount} of {sources.length} agent outputs included
              </span>
            </button>

            <button
              type="button"
              onClick={() => setComposingNew(true)}
              className="text-xs text-amber-700 hover:text-amber-800 font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Manage &amp; Run Agent Inputs
            </button>
          </div>

          {showSourceDrawer && (
            <div className="pt-2 border-t border-slate-200/80 space-y-2">
              <p className="text-xs text-slate-500">
                Click <strong>Open Agent</strong> to run any pending agent or refine its output, then click <strong>Regenerate</strong> above to incorporate findings.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {sources.map((src) => (
                  <div
                    key={src.key}
                    className={cn(
                      'flex items-center justify-between p-2.5 rounded-lg border text-xs',
                      src.ready ? 'bg-white border-emerald-200' : 'bg-slate-100/70 border-slate-200',
                    )}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-medium text-slate-800 truncate">{src.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {src.ready ? 'Synthesized' : src.required ? 'Required missing' : 'Not generated'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenAgent(src.tabKey)}
                      className="px-2 py-1 text-[11px] rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Editable Markdown Report */}
        <InlineEditableMarkdownReport
          report={report}
          markdownComponents={markdownComponents}
          onSave={async (markdown) => {
            const res = await fetch('/api/buyer-report', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clientId, workstream, markdown }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to save buyer report.')
            setReport(data.report)
            showToast('Buyer report saved successfully', 'success')
          }}
        />

        {/* Delete Confirmation Modal */}
        <DeleteConfirmModal
          open={deleteModalOpen}
          title="Delete Buyer Report?"
          description="This will permanently delete the current buyer report. The underlying agent findings and roadmap will remain intact."
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDeleteReport}
          confirmLabel="Delete Report"
          isDeleting={isDeleting}
        />

        {/* Status Toast */}
        <StatusToast toast={toast} onClose={() => setToast(null)} />
      </div>
    )
  }

  // ── Launch / Setup View ───────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Unified Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            Buyer Report
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {clientName} &mdash; {wsLabel} &mdash; Buyer-Facing Acquisition Summary
          </p>
        </div>
        <AdvisorActions className="flex items-center gap-2 shrink-0">
          {composingNew && report && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setComposingNew(false)}
              className="h-8 text-xs cursor-pointer"
            >
              Cancel
            </Button>
          )}
        </AdvisorActions>
      </div>

      {!readOnly && (
        <AgentRunToolbar
          provider={provider}
          onProviderChange={setProvider}
          disabled={generating}
          historyItems={historyItems}
          activeId={composingNew ? null : activeId}
          onSelectRun={selectRun}
          activeProvider={composingNew ? null : activeRun?.aiProvider}
          activeModel={composingNew ? null : activeRun?.aiModel}
          activeVersion={composingNew ? null : activeRun?.version}
        />
      )}

      {/* Main Setup Workspace Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
        {/* Sector Header 1: Required Roadmap Input */}
        <div className="space-y-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Required Agent Input
              </span>
              <span
                className={cn(
                  'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                  roadmapReady
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200',
                )}
              >
                {roadmapReady ? '1 of 1 ready' : '0 of 1 ready'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer transition-colors shrink-0"
            >
              <RotateCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
          <p className="text-xs text-slate-500">
            The Sales Readiness Roadmap is strictly required. Acquirers rely on the roadmap&apos;s strategic readiness scoring and prioritized action plan.
          </p>
        </div>

        {/* Required Slot Row */}
        <div className="space-y-3">
          {requiredSources.map((source) => (
            <AgentSourceRow key={source.key} source={source} onOpen={handleOpenAgent} />
          ))}
          {requiredSources.length === 0 && (
            <AgentSourceRow
              source={{
                key: 'roadmap',
                name: 'Sales Readiness Roadmap',
                tabKey: 'sales-readiness-roadmap',
                required: true,
                ready: roadmapReady,
                note: 'Strategic action plan and seller readiness rating. Required to generate buyer report.',
              }}
              onOpen={handleOpenAgent}
            />
          )}
        </div>

        {/* Sector Header 2: Optional Context Agent Inputs */}
        <div className="space-y-1 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Optional Context Agent Inputs ({wsLabel})
              </span>
              <span
                className={cn(
                  'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                  optionalReadyCount > 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200',
                )}
              >
                {optionalReadyCount} of {optionalSources.length} ready
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            These agent reports provide supplemental diligence context. Missing reports do not block generation &mdash; the buyer report synthesizes all available findings. Click <strong>Open Agent</strong> to run any pending agent.
          </p>
        </div>

        {/* Optional Slot Rows */}
        <div className="space-y-3">
          {optionalSources.map((source) => (
            <AgentSourceRow key={source.key} source={source} onOpen={handleOpenAgent} />
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-4 py-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            {error}
          </div>
        )}

        {generating && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-8 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-blue-600 mx-auto animate-spin" />
            <h3 className="text-base font-semibold text-slate-800">Generating Buyer Report...</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Synthesizing Sales Readiness Roadmap and findings from all {workstream === 'ws1' ? 'risk mitigation' : 'growth & profitability'} agents into an investment-grade buyer summary.
            </p>
          </div>
        )}

        {/* Readiness Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="w-full sm:w-auto">
            {roadmapReady ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Roadmap ready &bull; {optionalReadyCount} of {optionalSources.length} optional agent outputs ready to synthesize.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-800 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Sales Readiness Roadmap must be submitted before generating this buyer report.</span>
              </div>
            )}
          </div>

          <div className="w-full sm:w-auto flex items-center justify-end gap-3">
            {composingNew && report && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setComposingNew(false)}
                className="h-10 px-4 text-xs cursor-pointer"
              >
                Cancel
              </Button>
            )}
            <Button
              type="button"
              disabled={!roadmapReady || generating}
              onClick={generate}
              className={cn(
                'h-10 px-5 rounded-lg font-medium text-xs text-white shadow-xs inline-flex items-center gap-2 cursor-pointer transition-all',
                'bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Generating Buyer Report...</span>
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4 text-white" />
                  <span>Generate Buyer Report</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        title="Delete Buyer Report?"
        description="This will permanently delete the current buyer report. The underlying agent findings and roadmap will remain intact."
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteReport}
        confirmLabel="Delete Report"
        isDeleting={isDeleting}
      />

      {/* Status Toast */}
      <StatusToast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
