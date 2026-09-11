'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import type { AgentTabReadOnlyProps } from '@/types/agent-tab'
import { Button, cn, Badge } from '@/components/ui'
import { useWS111Analysis, type UploadedDoc } from '@/hooks/useWS111Analysis'
import { parseWS111Markdown } from '@/lib/ws1-11/parser'
import type { WS111Persistence, WS111Flag } from '@/types/ws1-11-types'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import InlineEditableMarkdownReport from '@/components/report-export/InlineEditableMarkdownReport'
import { AdvisorActions } from '@/components/client-portal/AgentClientPortalFrame'
import { buildTaxLiabilityReportHtml } from '@/lib/report-export/build-tax-liability-report'
import { TAX_READINESS_DOCUMENT_GROUPS, buildTaxReadinessReferenceHtml } from '@/lib/tax-readiness'
import {
  Upload,
  FileText,
  FileSpreadsheet,
  X,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCw,
  Clock,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { useAgentReportRuns } from '@/hooks/useAgentReportRuns'
import type { DocumentStatus } from '@/lib/store'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-5 border-b-2 border-stone-200 pb-3 text-2xl font-bold tracking-tight text-stone-900">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-3 mt-10 border-b border-stone-200 pb-2 text-lg font-bold tracking-tight text-stone-900">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-6 text-sm font-bold text-stone-800">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-4 text-sm leading-7 text-stone-700">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-bold text-stone-900">{children}</strong>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-5 list-disc space-y-2 pl-5 text-sm text-stone-700 marker:text-amber-500">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-stone-700 marker:text-amber-500">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-7">{children}</li>
  ),
  hr: () => <hr className="my-8 border-stone-200" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-stone-200">
      <table className="min-w-full divide-y divide-stone-200 text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-stone-50">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-stone-500">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-t border-stone-100 px-4 py-3 align-top text-sm leading-6 text-stone-700">{children}</td>
  ),
}

function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center space-y-3">
          <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center font-bold text-lg">
            !
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900">Delete Tax Liability Report?</h3>
            <p className="text-xs text-slate-500">
              This will permanently remove the tax liability analysis for this client. You will need to re-run the analysis to regenerate it.
            </p>
          </div>
        </div>
        <div className="flex border-t border-slate-100 p-3 gap-2 bg-slate-50/50 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs cursor-pointer">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className="h-8 text-xs bg-rose-600 text-white hover:bg-rose-700 border-none cursor-pointer"
          >
            Confirm Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusToast({
  message,
  type,
  onClose,
}: {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={cn(
        'fixed bottom-8 right-8 z-[100] px-5 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 animate-in slide-in-from-right-8 duration-300',
        type === 'success' ? 'bg-slate-900 text-white border-slate-800' : 'bg-rose-50 text-rose-700 border-rose-200'
      )}
    >
      <div className={cn('w-2 h-2 rounded-full', type === 'success' ? 'bg-emerald-400' : 'bg-rose-500')} />
      <p className="text-xs font-medium">{message}</p>
      <button onClick={onClose} className="ml-3 opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ── Flag Review Panel ───────────────────────────────────────────────────────

function FlagReviewPanel({
  flags,
  onConfirm,
  onNA,
  readOnly = false,
}: {
  flags: WS111Flag[]
  onConfirm: (id: string) => void
  onNA: (id: string) => void
  readOnly?: boolean
}) {
  const groups = [
    {
      key: 'deal-risk' as const,
      title: 'Red Flags — Requires Immediate Attention',
      emoji: '🔴',
      badge: 'red' as const,
      cardClass: 'bg-rose-50/50 border-rose-200',
      titleClass: 'text-rose-700',
    },
    {
      key: 'negotiation' as const,
      title: 'Yellow Flags — Requires Clarification',
      emoji: '🟡',
      badge: 'gold' as const,
      cardClass: 'bg-amber-50/50 border-amber-200',
      titleClass: 'text-amber-700',
    },
    {
      key: 'informational' as const,
      title: 'Green Flags — Informational',
      emoji: '🟢',
      badge: 'green' as const,
      cardClass: 'bg-emerald-50/50 border-emerald-200',
      titleClass: 'text-emerald-700',
    },
  ]

  const renderControls = (flag: WS111Flag) => {
    if (readOnly) {
      if (flag.status === 'confirmed') return <div className="mt-3 pt-3 border-t border-black/5"><Badge color="blue">Reviewed</Badge></div>
      if (flag.status === 'na') return <div className="mt-3 pt-3 border-t border-black/5"><Badge color="slate">Not Applicable</Badge></div>
      return null
    }

    if (flag.status === 'confirmed') {
      return (
        <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between">
          <Badge color="blue">Reviewed &amp; Confirmed</Badge>
          <button onClick={() => onNA(flag.id)} className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer">
            Mark N/A
          </button>
        </div>
      )
    }

    if (flag.status === 'na') {
      return (
        <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between">
          <Badge color="slate">Marked N/A</Badge>
          <button onClick={() => onConfirm(flag.id)} className="text-xs text-slate-400 hover:text-slate-600 underline cursor-pointer">
            Re-open
          </button>
        </div>
      )
    }

    return (
      <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => onNA(flag.id)} className="text-xs text-slate-500 h-7 cursor-pointer">
          Mark N/A
        </Button>
        <Button size="sm" onClick={() => onConfirm(flag.id)} className="text-xs h-7 cursor-pointer">
          Confirm Flag
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map(group => {
        const groupFlags = flags.filter(f => f.severity === group.key)
        if (!groupFlags.length) return null

        return (
          <div key={group.key} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">{group.emoji}</span>
              <h3 className={cn('text-xs font-bold uppercase tracking-wider', group.titleClass)}>{group.title}</h3>
              <Badge color={group.badge}>{groupFlags.length}</Badge>
            </div>
            <div className="space-y-3">
              {groupFlags.map(flag => (
                <div key={flag.id} className={cn('rounded-xl border p-4 shadow-2xs space-y-2', group.cardClass)}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">{flag.title}</p>
                    <Badge color={flag.status === 'confirmed' ? 'blue' : flag.status === 'na' ? 'slate' : group.badge}>
                      {flag.status === 'confirmed' ? 'Reviewed' : flag.status === 'na' ? 'N/A' : 'Pending'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{flag.description}</p>
                  {flag.action && (
                    <div className="rounded-lg bg-white/70 border border-black/5 p-3 text-xs text-slate-700">
                      <span className="font-semibold text-slate-900">Recommended Action: </span>
                      {flag.action}
                    </div>
                  )}
                  {renderControls(flag)}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tax Document Group Status Type ──────────────────────────────────────────

type TaxDocumentGroupStatus = {
  id: string
  title: string
  detail: string
  bestSource: string
  required: boolean
  uploaded: boolean
  documents: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number | null; uploadedAt: string }>
}

interface TaxLiabilityReviewTabProps extends AgentTabReadOnlyProps {
  clientId: string
  clientName: string
  state?: string
  entityType?: string
  fiscalYearEnd?: string
  numberOfEmployees?: string
  documentStatuses?: Record<string, DocumentStatus>
  onRefreshDocuments?: () => Promise<void>
}

export default function TaxLiabilityReviewTab({
  clientId,
  clientName,
  state,
  entityType,
  fiscalYearEnd,
  numberOfEmployees,
  documentStatuses,
  onRefreshDocuments,
  readOnly = false,
}: TaxLiabilityReviewTabProps) {
  const [savedReport, setSavedReport] = useState<WS111Persistence | null>(null)
  const [activeTab, setActiveTabState] = useState<'report' | 'flags'>('report')
  const [flags, setFlags] = useState<WS111Flag[]>([])
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null)

  const [taxDocGroups, setTaxDocGroups] = useState<TaxDocumentGroupStatus[]>([])
  const [loadingTaxDocs, setLoadingTaxDocs] = useState(false)
  const [taxDocsError, setTaxDocsError] = useState<string | null>(null)
  const [draftLoaded, setDraftLoaded] = useState(false)

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const { provider, setProvider } = useAgentAiProvider()
  const { documents, setDocuments, status, rawMarkdown, error, analyze, clearAll } = useWS111Analysis({
    clientId,
    clientName,
    state,
    entityType,
    fiscalYearEnd,
    numberOfEmployees,
  })

  const { historyItems, activeRun, activeId, setActiveId, reload, loading: loadingReport } = useAgentReportRuns(
    '/api/tax-liability-review/reports',
    clientId,
  )

  const isRunning = status === 'uploading' || status === 'streaming'

  const loadTaxDocs = useCallback(() => {
    let active = true
    setLoadingTaxDocs(true)
    setTaxDocsError(null)
    fetch(`/api/tax-liability-review/client-documents?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' })
      .then(async res => {
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
      .then(data => {
        if (!active) return
        setTaxDocGroups((data.groups ?? []) as TaxDocumentGroupStatus[])
      })
      .catch(err => {
        if (active) setTaxDocsError(err instanceof Error ? err.message : 'Failed to load tax documents.')
      })
      .finally(() => {
        if (active) setLoadingTaxDocs(false)
      })
    return () => { active = false }
  }, [clientId])

  useEffect(() => {
    return loadTaxDocs()
  }, [loadTaxDocs])

  const handleRefresh = async () => {
    loadTaxDocs()
    if (onRefreshDocuments) await onRefreshDocuments()
    setToast({ message: 'Tax documents refreshed', type: 'success' })
  }

  // Load draft advisor documents
  useEffect(() => {
    let active = true
    fetch(`/api/tax-liability-review/draft?clientId=${encodeURIComponent(clientId)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!active || !data?.draft?.documents?.length) return
        const draftDocs = (data.draft.documents as UploadedDoc[]).filter(
          (doc) => Boolean(doc.base64),
        )
        if (!draftDocs.length) return
        setDocuments(current => {
          const seen = new Set(current.map(doc => `${doc.slotKey}:${doc.name}`))
          const next = [...current]
          for (const doc of draftDocs) {
            const key = `${doc.slotKey}:${doc.name}`
            if (seen.has(key)) continue
            seen.add(key)
            next.push(doc)
          }
          return next
        })
      })
      .catch(console.error)
      .finally(() => {
        if (active) setDraftLoaded(true)
      })
    return () => { active = false }
  }, [clientId, setDocuments])

  // Save advisor draft documents
  useEffect(() => {
    if (!draftLoaded || savedReport || isRunning) return
    const advisorDocs = documents.filter((doc) => Boolean(doc.base64))
    if (!advisorDocs.length) {
      void fetch(`/api/tax-liability-review/draft?clientId=${encodeURIComponent(clientId)}`, { method: 'DELETE' })
      return
    }

    const timeout = window.setTimeout(() => {
      void fetch('/api/tax-liability-review/draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, documents: advisorDocs }),
      }).catch(console.error)
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [clientId, documents, draftLoaded, isRunning, savedReport])

  // Active run synchronization
  useEffect(() => {
    if (!activeRun?.markdown) {
      if (!loadingReport) setSavedReport(null)
      return
    }
    setSavedReport(activeRun as WS111Persistence)
    const { flags: pFlags } = parseWS111Markdown(activeRun.markdown, clientName)
    const savedStatuses = new Map(((activeRun.metadata as any)?.flags ?? []).map((f: any) => [f.id, f.status]))
    setFlags(pFlags.map(f => ({ ...f, status: (savedStatuses.get(f.id) as any) ?? 'pending' })))
  }, [activeRun, clientName, loadingReport])

  // Complete status synchronization
  useEffect(() => {
    if (status === 'complete' && rawMarkdown) {
      void reload({ selectNewest: true }).then(() => {
        setToast({ message: 'Tax liability review completed', type: 'success' })
      })
      clearAll()
      void fetch(`/api/tax-liability-review/draft?clientId=${encodeURIComponent(clientId)}`, { method: 'DELETE' })
    }
  }, [status, rawMarkdown, clearAll, reload, clientId])

  const handleFlagUpdate = async (id: string, action: 'confirmed' | 'na') => {
    const nextFlags = flags.map(f => (f.id === id ? { ...f, status: action as any } : f))
    setFlags(nextFlags)
    try {
      await fetch(`/api/tax-liability-review/reports?clientId=${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: { flags: nextFlags.map(f => ({ id: f.id, status: f.status })) },
        }),
      })
    } catch {
      setToast({ message: 'Failed to save flag status', type: 'error' })
    }
  }

  const handleSaveMarkdown = async (markdown: string) => {
    const res = await fetch(`/api/tax-liability-review/reports?clientId=${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to save tax liability report.')

    setSavedReport(data.report)
    const { flags: parsedFlags } = parseWS111Markdown(data.report.markdown, clientName)
    const savedStatuses = new Map(((data.report.metadata as any)?.flags ?? []).map((f: any) => [f.id, f.status]))
    setFlags(parsedFlags.map(f => ({ ...f, status: (savedStatuses.get(f.id) as any) ?? 'pending' })))
    setToast({ message: 'Report saved', type: 'success' })
  }

  const handleNewAnalysis = () => {
    setSavedReport(null)
    setFlags([])
    clearAll()
    loadTaxDocs()
  }

  const handleDelete = async () => {
    try {
      await fetch(`/api/tax-liability-review/reports?clientId=${clientId}`, { method: 'DELETE' })
      setSavedReport(null)
      setFlags([])
      clearAll()
      setDeleteModalOpen(false)
      setToast({ message: 'Report deleted', type: 'success' })
    } catch {
      setToast({ message: 'Failed to delete report', type: 'error' })
    }
  }

  const handleSlotFiles = useCallback(async (slotId: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const newDocs: UploadedDoc[] = []
    for (const file of Array.from(fileList)) {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      newDocs.push({
        name: file.name,
        base64,
        mediaType: file.type || 'application/octet-stream',
        slotKey: slotId,
        sizeBytes: file.size,
      })
    }
    setDocuments(prev => [...prev, ...newDocs])
    setToast({ message: `Added ${newDocs.length} ${newDocs.length === 1 ? 'file' : 'files'}`, type: 'success' })
  }, [setDocuments])

  const removeAdvisorDoc = (name: string) => {
    setDocuments(prev => prev.filter(d => d.name !== name))
    setToast({ message: `Removed ${name}`, type: 'success' })
  }

  // Calculate readiness stats across all slots
  const slotData = TAX_READINESS_DOCUMENT_GROUPS.map(group => {
    const groupStatus = taxDocGroups.find(g => g.id === group.id)
    const portalDocs = groupStatus?.documents ?? []
    const advisorDocs = documents.filter(
      d => d.slotKey === group.id || (group.id === 'tax_returns_3yr' && d.slotKey === 'advisor_tax_upload'),
    )
    const totalCount = portalDocs.length + advisorDocs.length
    const hasFiles = totalCount > 0
    return {
      ...group,
      portalDocs,
      advisorDocs,
      totalCount,
      hasFiles,
    }
  })

  const requiredSlots = slotData.filter(s => s.required)
  const readyRequiredCount = requiredSlots.filter(s => s.hasFiles).length
  const missingRequiredCount = requiredSlots.length - readyRequiredCount
  const totalFilesCount = slotData.reduce((sum, s) => sum + s.totalCount, 0)
  const canRun = !loadingTaxDocs && missingRequiredCount === 0 && totalFilesCount > 0

  if (loadingReport) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading tax liability review…</p>
        </div>
      </div>
    )
  }

  const readOnlyGate = agentTabReadOnlyGate(readOnly, loadingReport, Boolean(savedReport?.markdown), 'Tax Liability Review')
  if (readOnlyGate) return readOnlyGate

  // ── Running State ──
  if (isRunning && !savedReport) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 shadow-2xs text-center space-y-6">
        <div className="w-12 h-12 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-900">
            Analyzing tax documents…
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Reviewing tax returns, payroll liabilities, contractor 1099 compliance, and audit history. This typically takes 1-2 minutes.
          </p>
        </div>
        {rawMarkdown.length > 0 && (
          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-6 text-left max-h-[400px] overflow-auto shadow-inner">
            <div className="prose prose-slate prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{rawMarkdown}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Workspace / Upload Mode ──
  if (!savedReport) {
    return (
      <div className="space-y-6">
        {/* Header Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
              Tax Liability Review
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Federal, state, payroll, sales tax compliance, and historical audit review for {clientName}
            </p>
          </div>

          <AdvisorActions className="flex items-center gap-2 shrink-0">
            <ExportReportButton
              html={buildTaxReadinessReferenceHtml(clientName)}
              fileName={`${clientName.replace(/\s+/g, '-').toLowerCase()}-tax-reference-guide`}
              label="Tax Reference Guide"
            />
          </AdvisorActions>
        </div>

        {/* AI Provider Bar */}
        {!readOnly && (
          <AgentRunToolbar
            provider={provider}
            onProviderChange={setProvider}
            disabled={isRunning}
            historyItems={historyItems}
            activeId={activeId}
            onSelectRun={run => setActiveId(run.id)}
            activeProvider={savedReport?.aiProvider}
            activeModel={savedReport?.aiModel}
            activeVersion={savedReport?.version}
          />
        )}

        {/* Main Workspace Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
          {/* Card Title Block */}
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Tax Liability Review Source Documents
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Review documents uploaded by the client or upload files directly. Upload required tax returns and payroll forms to run analysis.
            </p>
          </div>

          {/* Sector Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  REQUIRED &amp; OPTIONAL TAX DOCUMENTS
                </h4>
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                    missingRequiredCount === 0 && totalFilesCount > 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {readyRequiredCount} of {requiredSlots.length} ready
                </span>
                {totalFilesCount > 0 && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {totalFilesCount} {totalFilesCount === 1 ? 'file' : 'files'}
                  </span>
                )}
              </div>

              <button
                onClick={handleRefresh}
                disabled={loadingTaxDocs}
                className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RotateCw className={cn('w-3 h-3', loadingTaxDocs && 'animate-spin')} />
                Refresh
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Review income tax returns, payroll filings, 1099 contractor records, and sales tax returns. Missing required items must be provided before running analysis.
            </p>
          </div>

          {taxDocsError && (
            <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/60 text-xs text-rose-700">
              {taxDocsError}
            </div>
          )}

          {/* Document Slot Cards */}
          <div className="space-y-3">
            {slotData.map(slot => {
              const isExcel = slot.id.includes('tax') || slot.id.includes('1099')
              const isDragging = dragOverSlot === slot.id

              return (
                <div
                  key={slot.id}
                  onDragOver={e => {
                    e.preventDefault()
                    setDragOverSlot(slot.id)
                  }}
                  onDragLeave={() => setDragOverSlot(null)}
                  onDrop={e => {
                    e.preventDefault()
                    setDragOverSlot(null)
                    if (e.dataTransfer.files) {
                      void handleSlotFiles(slot.id, e.dataTransfer.files)
                    }
                  }}
                  className={cn(
                    'rounded-xl border p-4 transition-all shadow-2xs',
                    isDragging
                      ? 'border-indigo-400 bg-indigo-50/30'
                      : slot.hasFiles
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : 'border-slate-200/80 bg-white',
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={cn(
                          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                          slot.hasFiles
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-slate-100 text-slate-400',
                        )}
                      >
                        {isExcel ? <FileSpreadsheet className="w-4.5 h-4.5" /> : <FileText className="w-4.5 h-4.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-800">{slot.title}</p>
                          <span
                            className={cn(
                              'text-[10px] font-semibold px-2 py-0.5 rounded-md border',
                              slot.required
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200',
                            )}
                          >
                            {slot.required ? 'Required' : 'Optional'}
                          </span>
                          {slot.hasFiles ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Uploaded ({slot.totalCount} ready)
                            </span>
                          ) : slot.required ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              <Clock className="w-3 h-3 text-slate-500" /> Missing
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-200">
                              Not provided
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{slot.detail}</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Source: {slot.bestSource}
                        </p>

                        {/* File Chips */}
                        {slot.hasFiles && (
                          <div className="flex flex-wrap gap-2 mt-3 pt-2.5 border-t border-slate-100">
                            {/* Portal Docs */}
                            {slot.portalDocs.map(doc => (
                              <a
                                key={doc.id}
                                href={`/api/client-documents/view?clientId=${encodeURIComponent(clientId)}&documentId=${encodeURIComponent(slot.id)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-emerald-200 text-emerald-900 shadow-2xs hover:bg-emerald-50 transition-colors"
                                title="Click to view file"
                              >
                                <span className="max-w-[200px] truncate">{doc.fileName}</span>
                                {doc.sizeBytes != null && (
                                  <span className="text-[10px] text-slate-400">{formatBytes(doc.sizeBytes)}</span>
                                )}
                                <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold">
                                  Portal
                                </span>
                                <ExternalLink className="w-3 h-3 text-emerald-600 ml-0.5" />
                              </a>
                            ))}

                            {/* Advisor Docs */}
                            {slot.advisorDocs.map(doc => (
                              <div
                                key={doc.name}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-800 shadow-2xs"
                              >
                                <span className="max-w-[200px] truncate">{doc.name}</span>
                                {doc.sizeBytes != null && (
                                  <span className="text-[10px] text-slate-400">{formatBytes(doc.sizeBytes)}</span>
                                )}
                                <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100">
                                  Advisor
                                </span>
                                {!readOnly && (
                                  <button
                                    type="button"
                                    onClick={() => removeAdvisorDoc(doc.name)}
                                    className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer ml-0.5"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Upload Action Button */}
                    {!readOnly && (
                      <div className="shrink-0 pt-0.5">
                        <input
                          ref={el => {
                            fileInputRefs.current[slot.id] = el
                          }}
                          type="file"
                          multiple
                          accept=".pdf,.docx,.xlsx,.doc,.png,.jpg,.jpeg"
                          className="hidden"
                          onChange={e => {
                            void handleSlotFiles(slot.id, e.target.files)
                            e.target.value = ''
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRefs.current[slot.id]?.click()}
                          className="gap-1.5 h-8 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-slate-500" />
                          Upload file(s)
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Bottom Readiness & Action Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2">
              {missingRequiredCount > 0 ? (
                <div className="flex items-center gap-2 text-xs text-amber-700 font-medium">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    {missingRequiredCount} required tax document group{missingRequiredCount === 1 ? '' : 's'} still missing. Upload required files to run analysis.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    All required tax documents ready ({totalFilesCount} {totalFilesCount === 1 ? 'file' : 'files'}). You can run tax liability review.
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              {documents.length > 0 && !isRunning && !readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDocuments([])}
                  className="h-8 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Clear Advisor Files
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => analyze(provider)}
                disabled={isRunning || !canRun}
                className="gap-1.5 h-8 text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {isRunning ? 'Analyzing…' : `Run Tax Liability Review${totalFilesCount > 0 ? ` (${totalFilesCount})` : ''}`}
              </Button>
            </div>
          </div>
        </div>

        {/* Status Toast Feedback */}
        {toast && (
          <StatusToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
      </div>
    )
  }

  // ── Report View Mode ──
  const { report } = parseWS111Markdown(savedReport?.markdown || '', clientName)
  const dealRiskCount = flags.filter(f => f.severity === 'deal-risk').length
  const negotiationCount = flags.filter(f => f.severity === 'negotiation').length

  const tabs = readOnly
    ? [{ id: 'report' as const, label: 'Full Report' }]
    : [
        { id: 'report' as const, label: 'Full Report' },
        { id: 'flags' as const, label: `Flags (${flags.length})` },
      ]

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            Tax Liability Review
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Generated {savedReport?.createdAt ? new Date(savedReport.createdAt).toLocaleString() : '—'}
          </p>

          <div className="flex items-center gap-2 mt-2">
            {dealRiskCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
                {dealRiskCount} Deal Risk{dealRiskCount !== 1 ? 's' : ''}
              </span>
            )}
            {negotiationCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
                {negotiationCount} Negotiation
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
              {flags.filter(f => f.severity === 'informational').length} Info
            </span>
          </div>
        </div>

        <AdvisorActions className="flex items-center gap-2 shrink-0">
          <ExportReportButton
            html={buildTaxLiabilityReportHtml(report, flags, clientName)}
            fileName={`tax-liability-report-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
            label="Export Tax Report"
          />
          {!readOnly && (
            <>
              <Button variant="outline" size="sm" onClick={handleNewAnalysis} className="h-8 text-xs cursor-pointer">
                + New Analysis
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteModalOpen(true)}
                className="h-8 text-xs text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </Button>
            </>
          )}
        </AdvisorActions>
      </div>

      {/* AI Provider & Version History Toolbar */}
      <AgentRunToolbar
        provider={provider}
        onProviderChange={setProvider}
        disabled={isRunning}
        historyItems={historyItems}
        activeId={activeId}
        onSelectRun={run => setActiveId(run.id)}
        activeProvider={savedReport?.aiProvider}
        activeModel={savedReport?.aiModel}
        activeVersion={savedReport?.version}
      />

      {/* Navigation Sub-Tabs */}
      {tabs.length > 1 && (
        <div className="flex border-b border-slate-200">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTabState(t.id)}
              className={cn(
                'px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors cursor-pointer',
                activeTab === t.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Report Tab vs Flags Tab */}
      {activeTab === 'report' ? (
        <InlineEditableMarkdownReport
          report={{ markdown: savedReport?.markdown || '' }}
          markdownComponents={markdownComponents}
          onSave={handleSaveMarkdown}
          readOnly={readOnly}
        />
      ) : (
        <FlagReviewPanel
          flags={flags}
          onConfirm={id => handleFlagUpdate(id, 'confirmed')}
          onNA={id => handleFlagUpdate(id, 'na')}
          readOnly={readOnly}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
      />

      {/* Toast Feedback */}
      {toast && (
        <StatusToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
