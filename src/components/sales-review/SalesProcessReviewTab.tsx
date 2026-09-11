'use client'

import type { AgentTabReadOnlyProps } from '@/types/agent-tab'
import { AdvisorActions, ClientApprovedEmptyState } from '@/components/client-portal/AgentClientPortalFrame'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Badge, Button, Textarea, cn } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { buildSalesReviewReportHtml } from '@/lib/report-export/build-sales-review-report'
import { getAdminEmail } from '@/lib/store'
import type { SalesProcessReviewResult } from '@/lib/sales-review/types'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'

interface Props extends AgentTabReadOnlyProps {
  clientId: string
  clientName: string
}

interface UploadedDoc {
  id: string
  fileName: string
  mimeType?: string
  uploadedAt?: string
}

interface SalesDocumentSlot {
  key: string
  documentId: string
  label: string
  note: string
  required: boolean
  accept: string
}

const SALES_DOCUMENT_SLOTS: SalesDocumentSlot[] = [
  {
    key: 'sales_process_transcript',
    documentId: 'sales_process_transcript',
    label: 'Sales Call & Meeting Transcript',
    note: 'Audio transcription, customer inquiry calls, sales conversation notes, or discovery meeting recordings (.pdf, .txt, .doc, .docx).',
    required: true,
    accept: '.pdf,.txt,.doc,.docx',
  },
]

async function readFriendlyError(res: Response, fallback: string) {
  const text = await res.text().catch(() => '')
  if (res.status === 404 && /This page could not be found|<!DOCTYPE html/i.test(text)) {
    return 'Sales Process Review analysis endpoint is not implemented yet.'
  }
  if (/<!DOCTYPE html/i.test(text)) {
    return `${fallback} Server returned an HTML error page instead of a JSON response.`
  }
  return text.trim() || fallback
}

function splitLines(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean)
}

function makeDraft(result: SalesProcessReviewResult) {
  return {
    summary: result.summary,
    keyFindings: result.keyFindings.join('\n'),
    benchmarkComparisons: result.benchmarkComparisons
      .map((row) => `${row.metric} | ${row.actual} | ${row.benchmark} | ${row.status}`)
      .join('\n'),
    recommendations: result.recommendations.join('\n'),
  }
}

function parseDraft(draft: ReturnType<typeof makeDraft>, generatedAt: string): SalesProcessReviewResult {
  const benchmarkComparisons: SalesProcessReviewResult['benchmarkComparisons'] = splitLines(draft.benchmarkComparisons).map((line) => {
    const [metric = '', actual = '', benchmark = '', rawStatus = 'at'] = line.split('|').map((part) => part.trim())
    const status: SalesProcessReviewResult['benchmarkComparisons'][number]['status'] =
      rawStatus === 'above' || rawStatus === 'below' || rawStatus === 'at' ? rawStatus : 'at'
    return { metric, actual, benchmark, status }
  }).filter((row) => row.metric || row.actual || row.benchmark)

  return {
    summary: draft.summary.trim() || 'No summary provided.',
    keyFindings: splitLines(draft.keyFindings),
    benchmarkComparisons,
    recommendations: splitLines(draft.recommendations),
    generatedAt,
  }
}

function statusColor(status: SalesProcessReviewResult['benchmarkComparisons'][number]['status']): 'red' | 'gold' | 'green' {
  if (status === 'above') return 'green'
  if (status === 'below') return 'red'
  return 'gold'
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

// ── Sales Slot Row ─────────────────────────────────────────────────────────
function SalesSlotRow({
  slot,
  docs,
  onUpload,
  onDelete,
  uploading,
  readOnly,
}: {
  slot: SalesDocumentSlot
  docs: UploadedDoc[]
  onUpload: (documentId: string, files: FileList | null) => Promise<void>
  onDelete: (docId: string) => Promise<void>
  uploading: boolean
  readOnly?: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasFiles = docs.length > 0

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all shadow-2xs',
        hasFiles ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200/80 bg-white',
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={slot.accept}
        multiple
        className="hidden"
        onChange={(e) => {
          void onUpload(slot.documentId, e.target.files)
          e.target.value = ''
        }}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                hasFiles ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400',
              )}
            >
              <FileText className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-800">{slot.label}</p>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                  Required
                </span>
                {hasFiles ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Uploaded
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-200">
                    Not provided
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{slot.note}</p>

              {/* Uploaded files display */}
              {hasFiles ? (
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {docs.map((doc) => (
                    <div
                      key={doc.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-emerald-200 text-emerald-900 shadow-2xs hover:bg-emerald-50 transition-colors"
                    >
                      <a
                        href={`/api/client-documents/download?id=${encodeURIComponent(doc.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 hover:underline"
                        title="Click to view file"
                      >
                        <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate max-w-[240px]">{doc.fileName}</span>
                        {doc.uploadedAt && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            &middot; {new Date(doc.uploadedAt).toLocaleDateString()}
                          </span>
                        )}
                      </a>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => void onDelete(doc.id)}
                          className="ml-1 text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                          title="Remove file"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-1.5">
                  Not provided yet (required &mdash; advisor can upload sales call transcripts directly)
                </p>
              )}
            </div>
          </div>
        </div>

        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="h-8 text-xs gap-1.5 shrink-0 cursor-pointer"
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                Upload
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function SalesProcessReviewTab({ clientId, clientName, readOnly = false }: Props) {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [savedBadge, setSavedBadge] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([])
  const [result, setResult] = useState<SalesProcessReviewResult | null>(null)
  const [draft, setDraft] = useState<ReturnType<typeof makeDraft> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [composingNew, setComposingNew] = useState(false)

  const { provider, setProvider } = useAgentAiProvider()
  const {
    runs,
    historyItems,
    activeRun,
    activeId,
    setActiveId,
    reload: reloadRuns,
    loading: loadingRuns,
  } = useGenericAgentRuns(clientId, AGENT_RUN_KEYS.salesProcessReview)

  const editMode = Boolean(draft)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
  }

  const loadDocuments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/client-documents?clientId=${encodeURIComponent(clientId)}&documentId=sales_process_transcript&all=true`,
        { cache: 'no-store' },
      )
      if (res.ok) {
        const data = await res.json()
        setUploadedDocs(data?.documents || [])
        return data?.documents || []
      }
    } catch (err) {
      console.error('Failed to load sales transcripts', err)
    }
    return []
  }, [clientId])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true)
      if (!opts?.silent) setError(null)
      try {
        const [docsRes, singleRes] = await Promise.all([
          fetch(
            `/api/client-documents?clientId=${encodeURIComponent(clientId)}&documentId=sales_process_transcript&all=true`,
            { cache: 'no-store' },
          ),
          fetch(
            `/api/client-documents?clientId=${encodeURIComponent(clientId)}&documentId=sales_process_transcript`,
            { cache: 'no-store' },
          ),
        ])

        if (docsRes.ok) {
          const docsData = await docsRes.json()
          setUploadedDocs(docsData?.documents || [])
        }
        if (singleRes.ok) {
          const singleData = await singleRes.json()
          if (!activeRun?.report && singleData?.analysis) {
            setResult(singleData.analysis)
          }
        }
      } catch (err: any) {
        setError(err?.message ?? 'Failed to load sales process review')
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [clientId, activeRun],
  )

  useEffect(() => {
    if (loadingRuns || composingNew) return
    if (activeRun?.report) {
      setResult(activeRun.report as SalesProcessReviewResult)
      setLoading(false)
      void loadDocuments()
      return
    }
    void load()
  }, [activeRun, loadingRuns, load, loadDocuments, composingNew])

  function selectRun(run: AgentRunHistoryItem) {
    setComposingNew(false)
    setActiveId(run.id)
    const full = runs.find((item) => item.id === run.id)
    if (full?.report) {
      setResult(full.report as SalesProcessReviewResult)
      setDraft(null)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadDocuments()
      showToast('Transcripts refreshed', 'success')
    } catch {
      showToast('Failed to refresh transcripts', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const handleUploadDoc = async (documentId: string, files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const formData = new FormData()
        formData.append('file', file)
        formData.append('clientId', clientId)
        formData.append('documentId', documentId)
        formData.append('uploaderEmail', getAdminEmail())
        const res = await fetch('/api/client-documents/upload', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          throw new Error(await readFriendlyError(res, 'Upload failed.'))
        }
      }
      await loadDocuments()
      showToast('Transcript uploaded successfully', 'success')
    } catch (err: any) {
      setError(err?.message ?? 'Upload failed')
      showToast(err?.message ?? 'Upload failed', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDoc = async (docId: string) => {
    try {
      const res = await fetch('/api/client-documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, recordId: docId }),
      })
      if (!res.ok) throw new Error('Failed to delete document')
      await loadDocuments()
      showToast('Transcript removed', 'success')
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to remove document', 'error')
    }
  }

  const runAnalysis = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/sales-review/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          provider,
          modelId: resolveAgentModelId(provider),
        }),
      })
      if (!res.ok) throw new Error(await readFriendlyError(res, 'Analysis failed.'))
      const nextResult = await res.json()
      setResult(nextResult)
      setDraft(null)

      const primaryFileName = uploadedDocs[0]?.fileName ?? 'Sales Call Transcript'
      await saveAgentAnalysisRunClient({
        clientId,
        agentKey: AGENT_RUN_KEYS.salesProcessReview,
        fileName: `${clientName} — Sales Process Review (${primaryFileName})`,
        report: nextResult,
        aiProvider: provider,
        aiModel: resolveAgentModelId(provider),
      })
      setComposingNew(false)
      await reloadRuns({ selectNewest: true })
      showToast('Sales process review completed successfully', 'success')
    } catch (err: any) {
      setError(err.message || 'Failed to run analysis')
      showToast(err.message || 'Failed to run analysis', 'error')
    } finally {
      setRunning(false)
    }
  }

  const handleDeleteReport = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/sales-review/analyze?clientId=${encodeURIComponent(clientId)}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete report')
      setResult(null)
      setDraft(null)
      setError(null)
      setActiveId(null)
      setComposingNew(false)
      await reloadRuns()
      setDeleteModalOpen(false)
      showToast('Sales process review report deleted', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to delete report', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const saveEditedResult = async () => {
    if (!draft || !result) return
    const next = parseDraft(draft, result.generatedAt || new Date().toISOString())
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/sales-review/analyze', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, result: next }),
      })
      if (!res.ok) throw new Error(await readFriendlyError(res, 'Failed to save sales process review.'))
      const saved = await res.json()
      setResult(saved)
      setDraft(null)
      setSavedBadge(true)
      showToast('Sales process review saved', 'success')
      setTimeout(() => setSavedBadge(false), 2000)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save sales process review')
      showToast(err?.message ?? 'Failed to save sales process review', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    )
  }

  if (readOnly && !result) {
    return <ClientApprovedEmptyState agentName="Sales Process Review" />
  }

  // ── Results View ──────────────────────────────────────────────────────────
  if (result && !composingNew) {
    return (
      <div className="space-y-6">
        {/* Unified Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
              Sales Process Review
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {clientName} &mdash; {result.benchmarkComparisons.length} benchmarks assessed &mdash; Generated{' '}
              {new Date(result.generatedAt || Date.now()).toLocaleString()}
            </p>
          </div>
          <AdvisorActions className="flex items-center gap-2.5 flex-wrap">
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (editMode) setDraft(null)
                  else setDraft(makeDraft(result))
                }}
                className={cn('h-8 text-xs cursor-pointer', editMode && 'bg-amber-50 text-amber-700 border-amber-300')}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" />
                {editMode ? 'Cancel Edit' : 'Edit Output'}
              </Button>
            )}
            {!readOnly && editMode && (
              <div className="relative">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void saveEditedResult()}
                  disabled={saving}
                  className="h-8 text-xs cursor-pointer bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                {savedBadge && (
                  <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                    Saved
                  </span>
                )}
              </div>
            )}
            <ExportReportButton
              html={buildSalesReviewReportHtml(result, clientName)}
              fileName={`sales-process-review-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
              label="Export PDF"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={running}
              onClick={() => void runAnalysis()}
              className="h-8 text-xs cursor-pointer"
            >
              <RefreshCw className={cn('w-3.5 h-3.5 mr-1', running && 'animate-spin')} />
              Re-run
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
            disabled={running || uploading || saving}
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

        {running && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-10 text-center space-y-3 shadow-2xs">
            <Loader2 className="w-8 h-8 text-amber-600 mx-auto animate-spin" />
            <h3 className="text-base font-semibold text-slate-800">Analyzing Sales Process...</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Reviewing sales call transcripts against discovery quality, objection handling, follow-up discipline, and booking conversion benchmarks.
            </p>
          </div>
        )}

        {/* Results Content */}
        {!editMode && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Key Findings</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{result.keyFindings.length}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Identified inquiry &amp; call points</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Benchmarks</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{result.benchmarkComparisons.length}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Industry metrics compared</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
                <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Recommendations</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{result.recommendations.length}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Actionable sales enhancements</p>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Executive Summary</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{result.summary}</p>
            </div>

            {/* Key Findings */}
            {result.keyFindings.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-amber-600" />
                  Key Findings
                </h4>
                <ul className="space-y-2.5">
                  {result.keyFindings.map((finding, i) => (
                    <li key={i} className="text-sm text-slate-700 flex items-start gap-2.5">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="leading-relaxed">{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Benchmark Comparisons */}
            {result.benchmarkComparisons.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800">Benchmark Comparisons</h4>
                  <span className="text-xs text-slate-400">{result.benchmarkComparisons.length} metrics evaluated</span>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-left py-2.5 px-3.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                          Metric
                        </th>
                        <th className="text-left py-2.5 px-3.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                          Actual
                        </th>
                        <th className="text-left py-2.5 px-3.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                          Benchmark
                        </th>
                        <th className="text-right py-2.5 px-3.5 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {result.benchmarkComparisons.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-3.5 font-medium text-slate-800">{row.metric}</td>
                          <td className="py-2.5 px-3.5 text-slate-600">{row.actual}</td>
                          <td className="py-2.5 px-3.5 text-slate-600">{row.benchmark}</td>
                          <td className="py-2.5 px-3.5 text-right">
                            <Badge color={statusColor(row.status)}>{row.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs space-y-3">
                <h4 className="text-sm font-semibold text-slate-800">Recommendations &amp; Action Items</h4>
                <div className="space-y-2.5">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm text-slate-700 leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Source Transcripts Reference Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Source Transcripts</span>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setComposingNew(true)}
                    className="text-xs text-amber-700 hover:text-amber-800 font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Upload New or Additional Transcript
                  </button>
                )}
              </div>
              {uploadedDocs.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {uploadedDocs.map((doc) => (
                    <a
                      key={doc.id}
                      href={`/api/client-documents/download?id=${encodeURIComponent(doc.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{doc.fileName}</span>
                      {doc.uploadedAt && (
                        <span className="text-[10px] text-slate-400 font-normal">
                          &middot; {new Date(doc.uploadedAt).toLocaleDateString()}
                        </span>
                      )}
                      <ExternalLink className="w-3 h-3 text-slate-400 ml-0.5" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">No source transcript records found in document archive.</p>
              )}
            </div>
          </>
        )}

        {/* Edit Form */}
        {result && editMode && draft && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h4 className="text-sm font-semibold text-slate-800">Edit Sales Process Review</h4>
              <p className="text-xs text-slate-400">Modify the AI analysis output directly</p>
            </div>
            <Textarea
              label="Summary"
              rows={6}
              value={draft.summary}
              onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
            />
            <Textarea
              label="Key Findings (one per line)"
              rows={7}
              value={draft.keyFindings}
              onChange={(event) => setDraft({ ...draft, keyFindings: event.target.value })}
            />
            <Textarea
              label="Benchmark Comparisons (metric | actual | benchmark | status)"
              rows={6}
              value={draft.benchmarkComparisons}
              onChange={(event) => setDraft({ ...draft, benchmarkComparisons: event.target.value })}
            />
            <Textarea
              label="Recommendations (one per line)"
              rows={7}
              value={draft.recommendations}
              onChange={(event) => setDraft({ ...draft, recommendations: event.target.value })}
            />
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <DeleteConfirmModal
          open={deleteModalOpen}
          title="Delete Sales Process Review?"
          description="This will permanently delete the current sales process review report. The uploaded transcript files will remain safely stored."
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
            Sales Process Review
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {clientName} &mdash; Review sales call and meeting transcripts against discovery quality, conversion, follow-up discipline, and booking performance benchmarks
          </p>
        </div>
        <AdvisorActions className="flex items-center gap-2 shrink-0">
          {composingNew && result && (
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
          disabled={running || uploading || saving}
          historyItems={historyItems}
          activeId={composingNew ? null : activeId}
          onSelectRun={selectRun}
          activeProvider={composingNew ? null : activeRun?.aiProvider}
          activeModel={composingNew ? null : activeRun?.aiModel}
          activeVersion={composingNew ? null : activeRun?.version}
        />
      )}

      {/* Main Setup Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
        {/* Sector Header */}
        <div className="space-y-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Sales Process Source Documents
              </span>
              <span
                className={cn(
                  'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                  uploadedDocs.length > 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200',
                )}
              >
                {uploadedDocs.length > 0 ? `${uploadedDocs.length} uploaded` : '0 of 1 uploaded'}
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
            Upload sales call recordings, phone transcripts, or discovery meeting notes. Advisors can upload files directly to evaluate sales discovery, objection handling, and booking close rates.
          </p>
        </div>

        {/* Document Slots */}
        <div className="space-y-3">
          {SALES_DOCUMENT_SLOTS.map((slot) => (
            <SalesSlotRow
              key={slot.key}
              slot={slot}
              docs={uploadedDocs}
              onUpload={handleUploadDoc}
              onDelete={handleDeleteDoc}
              uploading={uploading}
              readOnly={readOnly}
            />
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-4 py-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            {error}
          </div>
        )}

        {running && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-8 text-center space-y-3">
            <Loader2 className="w-7 h-7 text-amber-600 mx-auto animate-spin" />
            <p className="text-sm font-medium text-slate-800">Analyzing Sales Process...</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Evaluating transcript against discovery, objection handling, conversion benchmarks, and booking performance.
            </p>
          </div>
        )}

        {/* Readiness Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="w-full sm:w-auto">
            {uploadedDocs.length > 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {uploadedDocs.length} {uploadedDocs.length === 1 ? 'transcript' : 'transcripts'} ready. Ready to run sales process analysis.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-800 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Upload at least one sales call transcript to enable analysis.</span>
              </div>
            )}
          </div>

          <div className="w-full sm:w-auto flex items-center justify-end gap-3">
            {composingNew && result && (
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
              disabled={uploadedDocs.length === 0 || running || uploading}
              onClick={runAnalysis}
              className={cn(
                'h-10 px-5 rounded-lg font-medium text-xs text-white shadow-xs inline-flex items-center gap-2 cursor-pointer transition-all',
                'bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Analyzing Sales Process...</span>
                </>
              ) : (
                <>
                  <Bot className="w-4 h-4 text-white" />
                  <span>Run Analysis</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirm Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        title="Delete Sales Process Review?"
        description="This will permanently delete the current sales process review report. The uploaded transcript files will remain safely stored."
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
