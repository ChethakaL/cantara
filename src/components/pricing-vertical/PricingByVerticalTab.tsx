'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Upload,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  CheckCircle2,
  RefreshCw,
  RotateCw,
  FileText,
  FileSpreadsheet,
  Save,
  Pencil,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  BarChart3,
  Globe,
  Loader2,
  Trash2,
  X,
  Plus,
} from 'lucide-react'
import { Badge, Button, Card, cn } from '@/components/ui'
import type {
  PricingVerticalFlagResolution,
  PricingVerticalReport,
  PriceChangeEvent,
  ServicePricingRow,
  VerticalPricingSummary,
} from '@/lib/pricing-vertical/types'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { AdvisorActions } from '@/components/client-portal/AgentClientPortalFrame'
import { buildPricingVerticalReportHtml } from '@/lib/report-export/build-pricing-vertical-report'
import { enrichVerticalSummariesInReport } from '@/lib/pricing-vertical/enrich-vertical-summaries-from-grid'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'

const TREND_CONFIG: Record<string, { color: 'green' | 'gold' | 'red' | 'slate'; label: string; icon: typeof TrendingUp }> = {
  increasing: { color: 'green', label: 'Increasing', icon: TrendingUp },
  stable: { color: 'gold', label: 'Stable', icon: Minus },
  decreasing: { color: 'red', label: 'Decreasing', icon: TrendingDown },
  unknown: { color: 'slate', label: 'Unknown', icon: Clock },
}

const SEVERITY_COLORS: Record<string, 'red' | 'gold' | 'green' | 'blue'> = {
  critical: 'red',
  warning: 'gold',
  positive: 'green',
  informational: 'blue',
}

interface ToastState {
  message: string
  type: 'success' | 'error' | 'info'
}

function StatusToast({ toast, onClose }: { toast: ToastState | null; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => onClose(), 4000)
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

// ── Editable Cell helper ────────────────────────────────────────────────────
function EditableCell({
  value,
  onChange,
  editMode,
  className,
}: {
  value: string
  onChange: (val: string) => void
  editMode: boolean
  className?: string
}) {
  if (!editMode) {
    return <span className={cn('text-slate-700', className)}>{value}</span>
  }
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn(
        'w-full bg-white border border-amber-300 text-xs text-slate-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400',
        className,
      )}
    />
  )
}

// ── Document Slot Definition ────────────────────────────────────────────────
interface PricingDocumentSlot {
  key: string
  documentId: string
  label: string
  note: string
  required: boolean
  accept: string
  isSpreadsheet: boolean
}

const PRICING_DOCUMENT_SLOTS: PricingDocumentSlot[] = [
  {
    key: 'pricing_schedule',
    documentId: 'pricing_schedule',
    label: 'Current Pricing Schedule',
    note: 'Current rates for all services, plus any price changes or increases over the last 24 months (prior rate cards, old schedules, or notes showing when prices changed).',
    required: true,
    accept: '.pdf,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg',
    isSpreadsheet: false,
  },
  {
    key: 'revenue_breakdown',
    documentId: 'revenue_breakdown',
    label: 'Revenue Breakdown by Service Line (36 months)',
    note: 'Revenue split between boarding, daycare, grooming, training, etc. for the last 36 months — 3 fiscal years and trailing twelve months (TTM).',
    required: true,
    accept: '.xlsx,.xls,.csv,.pdf',
    isSpreadsheet: true,
  },
]

function PricingSlotRow({
  slot,
  docs,
  onUpload,
  onDelete,
  uploading,
  readOnly,
}: {
  slot: PricingDocumentSlot
  docs: Array<{ id: string; fileName: string; documentId: string; uploadedAt?: string }>
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
        onChange={e => {
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
              {slot.isSpreadsheet ? (
                <FileSpreadsheet className="w-4.5 h-4.5" />
              ) : (
                <FileText className="w-4.5 h-4.5" />
              )}
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
                  {docs.map(doc => (
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
                        {slot.isSpreadsheet ? (
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
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
                  Not provided yet (required &mdash; client will upload in client portal or advisor can upload directly)
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
                {hasFiles ? '+ Add more' : '+ Upload'}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

export default function PricingByVerticalTab({
  clientId,
  clientName,
  readOnly = false,
}: {
  clientId: string
  clientName: string
  readOnly?: boolean
}) {
  const [uploadedDocs, setUploadedDocs] = useState<Array<{
    id: string
    fileName: string
    documentId: string
    uploadedAt?: string
  }>>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PricingVerticalReport | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedBadge, setSavedBadge] = useState(false)
  const [reanalyzeNotice, setReanalyzeNotice] = useState<string | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [websiteDetectedFrom, setWebsiteDetectedFrom] = useState<'digitalPresence' | 'clientProfile' | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [composingNew, setComposingNew] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
  }, [])

  const { provider, setProvider } = useAgentAiProvider()
  const {
    runs,
    historyItems,
    activeRun,
    activeId,
    setActiveId,
    reload: reloadRuns,
    loading: loadingRuns,
  } = useGenericAgentRuns(clientId, AGENT_RUN_KEYS.pricingVertical)

  const loadUploadedPricingDocs = useCallback(async () => {
    try {
      const docIds = ['pricing_schedule', 'revenue_breakdown']
      const results = await Promise.all(
        docIds.map(async documentId => {
          const res = await fetch(
            `/api/client-documents?clientId=${encodeURIComponent(clientId)}&documentId=${encodeURIComponent(documentId)}&all=true`,
            { cache: 'no-store' },
          )
          if (!res.ok) return [] as Array<{ id: string; fileName: string; uploadedAt?: string; documentId: string }>
          const data = await res.json()
          const docs = Array.isArray(data?.documents) ? data.documents : []
          return docs.map((doc: { id: string; fileName: string; uploadedAt?: string }) => ({
            id: doc.id,
            fileName: doc.fileName,
            documentId,
            uploadedAt: doc.uploadedAt,
          }))
        }),
      )
      setUploadedDocs(results.flat())
    } catch {
      /* ignore */
    }
  }, [clientId])

  const loadWebsiteUrl = useCallback(async () => {
    try {
      const res = await fetch(`/api/client-data/${encodeURIComponent(clientId)}?section=digitalPresenceForm`)
      if (res.ok) {
        const data = await res.json()
        if (data?.websiteUrl) {
          setWebsiteUrl(prev => prev || data.websiteUrl)
          setWebsiteDetectedFrom('digitalPresence')
          return
        }
      }
      const compRes = await fetch(`/api/client-data/${encodeURIComponent(clientId)}?section=competitorPricingInputs`)
      if (compRes.ok) {
        const compData = await compRes.json()
        if (compData?.sellerWebsiteUrl) {
          setWebsiteUrl(prev => prev || compData.sellerWebsiteUrl)
          setWebsiteDetectedFrom('clientProfile')
        }
      }
    } catch {
      /* ignore */
    }
  }, [clientId])

  useEffect(() => {
    void loadUploadedPricingDocs()
    void loadWebsiteUrl()
  }, [loadUploadedPricingDocs, loadWebsiteUrl])

  useEffect(() => {
    if (!readOnly) return
    setEditMode(false)
  }, [readOnly])

  const enrichedResult = useMemo(
    () => (result ? enrichVerticalSummariesInReport(result) : null),
    [result],
  )

  const verticalSummariesView = editMode
    ? (result?.verticalSummaries ?? [])
    : (enrichedResult?.verticalSummaries ?? result?.verticalSummaries ?? [])

  useEffect(() => {
    if (loadingRuns) return
    if (activeRun?.report) {
      const payload = activeRun.report as PricingVerticalReport
      if (payload?.executiveSummary) {
        setResult({
          ...payload,
          verticalSummaries: (payload.verticalSummaries ?? []).map((v: VerticalPricingSummary) => ({
            ...v,
            revenueShare: '',
          })),
        })
      }
      return
    }
    const loadSaved = async () => {
      try {
        const res = await fetch(`/api/pricing-vertical?clientId=${encodeURIComponent(clientId)}`)
        if (res.ok) {
          const data = await res.json()
          if (data && data.executiveSummary) {
            setResult({
              ...data,
              verticalSummaries: (data.verticalSummaries ?? []).map((v: VerticalPricingSummary) => ({
                ...v,
                revenueShare: '',
              })),
            })
          }
        }
      } catch { /* ignore */ }
    }
    loadSaved()
  }, [clientId, activeRun, loadingRuns])

  function selectRun(run: AgentRunHistoryItem) {
    setActiveId(run.id)
    setComposingNew(false)
    const full = runs.find((item) => item.id === run.id)
    const payload = (full?.report ?? null) as PricingVerticalReport | null
    if (payload?.executiveSummary) {
      setResult({
        ...payload,
        verticalSummaries: (payload.verticalSummaries ?? []).map((v) => ({
          ...v,
          revenueShare: '',
        })),
      })
    }
  }

  const persistPricingVerticalRun = async (report: PricingVerticalReport) => {
    await saveAgentAnalysisRunClient({
      clientId,
      agentKey: AGENT_RUN_KEYS.pricingVertical,
      fileName: `${clientName} — Pricing by Vertical`,
      report,
      aiProvider: provider,
      aiModel: resolveAgentModelId(provider),
    })
    await reloadRuns({ selectNewest: true })
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        loadUploadedPricingDocs(),
        (async () => {
          const res = await fetch(`/api/client-data/${encodeURIComponent(clientId)}?section=digitalPresenceForm`)
          if (res.ok) {
            const data = await res.json()
            if (data?.websiteUrl) {
              setWebsiteUrl(data.websiteUrl)
              setWebsiteDetectedFrom('digitalPresence')
            }
          }
        })(),
      ])
      showToast('Refreshed rate card documents and website from Digital Presence', 'success')
    } catch {
      showToast('Failed to refresh data', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  const handleUploadDoc = async (documentId: string, files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadingSlot(documentId)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const formData = new FormData()
        formData.append('file', file)
        formData.append('clientId', clientId)
        formData.append('documentId', documentId)
        const res = await fetch('/api/client-documents/upload', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const errText = await res.text()
          throw new Error(errText || 'Upload failed')
        }
      }
      await loadUploadedPricingDocs()
      showToast('Document uploaded successfully', 'success')
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error')
    } finally {
      setUploadingSlot(null)
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
      await loadUploadedPricingDocs()
      showToast('Document removed', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to remove document', 'error')
    }
  }

  const handleReanalyze = async () => {
    if (!result) return
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetch('/api/pricing-vertical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          websiteUrl: websiteUrl.trim() || undefined,
          reanalyzeFromEdits: true,
          existingReport: result,
          provider,
          modelId: resolveAgentModelId(provider),
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Re-run failed (${res.status})`)
      }
      const data: PricingVerticalReport = await res.json()
      setResult(data)
      setEditMode(false)
      setReanalyzeNotice(
        'Analysis re-run complete. Your latest grid and timeline edits were applied, summaries refreshed, and the report is saved. You are back in view mode—click Edit anytime to change values again.',
      )
      window.setTimeout(() => setReanalyzeNotice(null), 9000)
      void persistPricingVerticalToServer(data, { silent: true })
      await persistPricingVerticalRun(data)
      showToast('Analysis re-run completed successfully', 'success')
    } catch (err: any) {
      setError(err.message || 'Re-run failed')
      showToast(err.message || 'Re-run failed', 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  const renamePricingPeriodLabel = (periodIndex: number, nextLabelRaw: string) => {
    if (!result) return
    const periods = [...(result.pricingPeriods ?? ['Current'])]
    if (periodIndex < 0 || periodIndex >= periods.length) return
    const oldLabel = periods[periodIndex]!
    const newLabel = nextLabelRaw.trim()
    if (!newLabel || oldLabel === newLabel) return
    periods[periodIndex] = newLabel
    const grid = (result.pricingGrid ?? []).map((row) => {
      const prices = { ...(row.prices ?? {}) }
      if (Object.prototype.hasOwnProperty.call(prices, oldLabel)) {
        prices[newLabel] = prices[oldLabel] as string
        delete prices[oldLabel]
      }
      return { ...row, prices }
    })
    setResult({ ...result, pricingPeriods: periods, pricingGrid: grid })
  }

  const handleAnalyze = async () => {
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetch('/api/pricing-vertical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          websiteUrl: websiteUrl.trim() || undefined,
          provider,
          modelId: resolveAgentModelId(provider),
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Analysis failed (${res.status})`)
      }
      const data: PricingVerticalReport = await res.json()
      setResult(data)
      setComposingNew(false)
      await persistPricingVerticalRun(data)
      showToast('Pricing grid built successfully', 'success')
    } catch (err: any) {
      setError(err.message || 'Analysis failed')
      showToast(err.message || 'Analysis failed', 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDeleteReport = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/pricing-vertical?clientId=${encodeURIComponent(clientId)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete report')
      setResult(null)
      setError(null)
      setEditMode(false)
      setActiveId(null)
      setComposingNew(false)
      await reloadRuns()
      setDeleteModalOpen(false)
      showToast('Pricing by vertical report deleted', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to delete report', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSave = async () => {
    if (!result) return
    await persistPricingVerticalToServer(result, { silent: false })
  }

  /** Persists full report to `sectionSubmissions.pricingVertical` (shared by Save and flag triage). */
  const persistPricingVerticalToServer = async (
    data: PricingVerticalReport,
    options: { silent: boolean },
  ) => {
    if (!options.silent) setSaving(true)
    try {
      const res = await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'pricingVertical', data }),
      })
      if (!res.ok) throw new Error('Save failed')
      if (!options.silent) {
        setSavedBadge(true)
        showToast('Pricing by vertical report saved', 'success')
        setTimeout(() => setSavedBadge(false), 2000)
      }
    } catch (err: any) {
      setError(err.message || 'Save failed')
      showToast(err.message || 'Save failed', 'error')
    } finally {
      if (!options.silent) setSaving(false)
    }
  }

  // ── Mutation helpers ────────────────────────────────────────────────────────
  const updatePriceChange = (index: number, field: keyof PriceChangeEvent, value: any) => {
    if (!result) return
    const changes = [...result.priceChanges]
    changes[index] = { ...changes[index], [field]: value }
    setResult({ ...result, priceChanges: changes })
  }

  const updateVerticalSummary = (index: number, field: keyof VerticalPricingSummary, value: any) => {
    if (!result) return
    const summaries = [...result.verticalSummaries]
    summaries[index] = { ...summaries[index], [field]: value }
    setResult({ ...result, verticalSummaries: summaries })
  }

  const updatePricingGridCell = (rowIndex: number, period: string, value: string) => {
    if (!result) return
    const grid = [...(result.pricingGrid ?? [])]
    const row = grid[rowIndex]
    if (!row) return
    grid[rowIndex] = { ...row, prices: { ...(row.prices ?? {}), [period]: value } }
    setResult({ ...result, pricingGrid: grid })
  }

  const updatePricingGridRow = (rowIndex: number, field: keyof ServicePricingRow, value: any) => {
    if (!result) return
    const grid = [...(result.pricingGrid ?? [])]
    const row = grid[rowIndex]
    if (!row) return
    grid[rowIndex] = { ...row, [field]: value }
    setResult({ ...result, pricingGrid: grid })
  }

  const addPricingRow = () => {
    if (!result) return
    const periods = result.pricingPeriods?.length ? result.pricingPeriods : ['Current']
    const prices = Object.fromEntries(periods.map(period => [period, '']))
    setResult({
      ...result,
      pricingGrid: [
        ...(result.pricingGrid ?? []),
        {
          id: `manual-${Date.now()}`,
          serviceName: '',
          vertical: '',
          source: 'manual',
          confidence: 'low',
          prices,
        },
      ],
    })
  }

  const removePricingRow = (rowIndex: number) => {
    if (!result) return
    const grid = [...(result.pricingGrid ?? [])]
    grid.splice(rowIndex, 1)
    setResult({ ...result, pricingGrid: grid })
  }

  const resolvePricingFlag = (flagId: string, resolution: PricingVerticalFlagResolution) => {
    if (!result) return
    const next: PricingVerticalReport = {
      ...result,
      flags: result.flags.map(f => (f.id === flagId ? { ...f, resolution } : f)),
    }
    setResult(next)
    void persistPricingVerticalToServer(next, { silent: true })
  }

  // ── Results view ────────────────────────────────────────────────────────────
  if (result && !composingNew) {
    return (
      <div className="space-y-6">
        {/* Unified Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
              Pricing by Vertical Analysis
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {clientName} &mdash; {result.verticalSummaries.length} verticals analyzed &mdash; Generated{' '}
              {new Date(result.generatedAt).toLocaleString()}
            </p>
          </div>
          <AdvisorActions className="flex items-center gap-2.5 flex-wrap">
            {!readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditMode(e => !e)}
                className={cn('h-8 text-xs cursor-pointer', editMode && 'bg-amber-50 text-amber-700 border-amber-300')}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" />
                {editMode ? 'Editing' : 'Edit'}
              </Button>
            )}
            {!readOnly && editMode && (
              <div className="relative">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
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
              html={buildPricingVerticalReportHtml(enrichedResult ?? result, clientName)}
              fileName={`pricing-vertical-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
              label="Export PDF"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={analyzing}
              onClick={() => void handleReanalyze()}
              className="h-8 text-xs cursor-pointer"
            >
              <RefreshCw className={cn('w-3.5 h-3.5 mr-1', analyzing && 'animate-spin')} />
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
            disabled={analyzing}
            historyItems={historyItems}
            activeId={activeId}
            onSelectRun={selectRun}
            activeProvider={activeRun?.aiProvider}
            activeModel={activeRun?.aiModel}
            activeVersion={activeRun?.version}
          />
        )}

        {reanalyzeNotice && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-3 text-sm text-emerald-900 bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-lg shadow-sm"
          >
            <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-900">Success</p>
              <p className="text-emerald-800/95 mt-0.5 leading-relaxed">{reanalyzeNotice}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Executive Summary */}
        <Card className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Executive Summary</h3>
          {editMode ? (
            <textarea
              value={result.executiveSummary}
              onChange={e => setResult({ ...result, executiveSummary: e.target.value })}
              rows={4}
              className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
            />
          ) : (
            <p className="text-sm text-slate-700 leading-relaxed">{result.executiveSummary}</p>
          )}
        </Card>

        {/* Overall Trend Badge */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Overall Pricing Trend:</span>
          {editMode ? (
            <input
              type="text"
              value={result.overallTrend}
              onChange={e => setResult({ ...result, overallTrend: e.target.value })}
              className="border border-amber-300 rounded px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-sm font-semibold text-slate-700">
              {result.overallTrend}
            </span>
          )}
        </div>

        {/* Editable 24-month pricing grid */}
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                24-Month Service Pricing Grid ({result.pricingGrid?.length ?? 0})
              </h3>
            </div>
            {editMode && (
              <button type="button" onClick={addPricingRow} className="text-xs text-amber-600 hover:text-amber-800 font-medium">
                + Add Service
              </button>
            )}
          </div>
          {editMode && (
            <p className="text-[11px] text-amber-800/90 px-5 pb-2 border-b border-slate-100">
              Edit the time column headers to match this resort&apos;s pricing cadence (e.g. quarterly vs. 6-month lookbacks). Labels sync to the exported PDF.
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500 min-w-[180px]">Service</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500 min-w-[120px]">Vertical</th>
                  {(result.pricingPeriods ?? ['Current']).map((period, periodIndex) => (
                    <th key={periodIndex} className="text-left px-4 py-2.5 font-semibold text-slate-500 min-w-[110px]">
                      {editMode ? (
                        <input
                          value={period}
                          onChange={e => renamePricingPeriodLabel(periodIndex, e.target.value)}
                          className="w-full min-w-[72px] bg-white border border-amber-300 text-xs font-semibold text-slate-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      ) : (
                        period
                      )}
                    </th>
                  ))}
                  {editMode && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {(result.pricingGrid ?? []).map((row, rowIndex) => {
                  const periods = result.pricingPeriods ?? ['Current']
                  return (
                    <tr key={row.id || rowIndex} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5">
                        {editMode ? (
                          <input
                            value={row.serviceName}
                            onChange={e => updatePricingGridRow(rowIndex, 'serviceName', e.target.value)}
                            className="w-full bg-white border border-amber-300 text-xs text-slate-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
                          />
                        ) : (
                          <span className="font-medium text-slate-800">{row.serviceName}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <EditableCell
                          value={row.vertical}
                          onChange={v => updatePricingGridRow(rowIndex, 'vertical', v)}
                          editMode={editMode}
                        />
                      </td>
                      {periods.map((period, pi) => (
                        <td key={`${row.id}-${period}-${pi}`} className="px-4 py-2.5">
                          <EditableCell
                            value={row.prices?.[period] ?? ''}
                            onChange={v => updatePricingGridCell(rowIndex, period, v)}
                            editMode={editMode}
                          />
                        </td>
                      ))}
                      {editMode && (
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => removePricingRow(rowIndex)} className="text-red-400 hover:text-red-600 text-xs">
                            &times;
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {(!result.pricingGrid || result.pricingGrid.length === 0) && (
                  <tr>
                    <td
                      colSpan={2 + (result.pricingPeriods?.length ?? 1) + (editMode ? 1 : 0)}
                      className="px-4 py-6 text-center text-slate-400 text-sm"
                    >
                      No current service prices found. Enter services manually in edit mode.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Price Change Timeline Table */}
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Price Change Timeline ({result.priceChanges.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Date</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Service</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Previous Price</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">New Price</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-500">$ Change</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-slate-500">% Change</th>
                </tr>
              </thead>
              <tbody>
                {result.priceChanges.map((change, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <EditableCell
                        value={change.date}
                        onChange={v => updatePriceChange(i, 'date', v)}
                        editMode={editMode}
                      />
                    </td>
                    <td className="px-4 py-2.5 font-medium">
                      <EditableCell
                        value={change.serviceVertical}
                        onChange={v => updatePriceChange(i, 'serviceVertical', v)}
                        editMode={editMode}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <EditableCell
                        value={change.previousPrice}
                        onChange={v => updatePriceChange(i, 'previousPrice', v)}
                        editMode={editMode}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <EditableCell
                        value={change.newPrice}
                        onChange={v => updatePriceChange(i, 'newPrice', v)}
                        editMode={editMode}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {editMode ? (
                        <input
                          type="text"
                          value={change.dollarChange !== null ? String(change.dollarChange) : ''}
                          onChange={e => {
                            const val = e.target.value
                            updatePriceChange(i, 'dollarChange', val === '' ? null : parseFloat(val) || 0)
                          }}
                          className="w-20 bg-white border border-amber-300 text-xs text-slate-700 rounded px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      ) : (
                        <span className={cn(
                          'font-medium',
                          change.dollarChange !== null && change.dollarChange > 0 && 'text-emerald-600',
                          change.dollarChange !== null && change.dollarChange < 0 && 'text-red-600',
                        )}>
                          {change.dollarChange !== null
                            ? `${change.dollarChange >= 0 ? '+' : ''}$${Math.abs(change.dollarChange).toFixed(2)}`
                            : 'N/A'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {editMode ? (
                        <input
                          type="text"
                          value={change.percentChange !== null ? String(change.percentChange) : ''}
                          onChange={e => {
                            const val = e.target.value
                            updatePriceChange(i, 'percentChange', val === '' ? null : parseFloat(val) || 0)
                          }}
                          className="w-20 bg-white border border-amber-300 text-xs text-slate-700 rounded px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                      ) : (
                        <span className={cn(
                          'font-medium',
                          change.percentChange !== null && change.percentChange > 0 && 'text-emerald-600',
                          change.percentChange !== null && change.percentChange < 0 && 'text-red-600',
                        )}>
                          {change.percentChange !== null
                            ? `${change.percentChange >= 0 ? '+' : ''}${change.percentChange.toFixed(1)}%`
                            : 'N/A'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {result.priceChanges.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-400 text-sm">
                      No price changes found in the document.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Vertical Summaries — Cards */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">
            Vertical Summaries ({verticalSummariesView.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {verticalSummariesView.map((vs, i) => {
              const trendConfig = TREND_CONFIG[vs.trend] || TREND_CONFIG.unknown
              const TrendIcon = trendConfig.icon
              return (
                <Card key={i} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    {editMode ? (
                      <input
                        value={vs.vertical}
                        onChange={e => updateVerticalSummary(i, 'vertical', e.target.value)}
                        className="border border-amber-300 rounded px-2 py-1 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    ) : (
                      <h4 className="text-sm font-semibold text-slate-800">{vs.vertical}</h4>
                    )}
                    <Badge color={trendConfig.color}>
                      <TrendIcon className="w-3 h-3 mr-1 inline" />
                      {trendConfig.label}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">Current Price</p>
                      {editMode ? (
                        <input
                          value={vs.currentPrice}
                          onChange={e => updateVerticalSummary(i, 'currentPrice', e.target.value)}
                          className="w-full border border-amber-300 rounded px-1 py-0.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 mt-0.5"
                        />
                      ) : (
                        <p className="text-sm font-bold text-slate-800 mt-0.5">{vs.currentPrice}</p>
                      )}
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">Changes (24mo)</p>
                      {editMode ? (
                        <input
                          type="number"
                          value={vs.priceChanges24Mo}
                          onChange={e => updateVerticalSummary(i, 'priceChanges24Mo', parseInt(e.target.value) || 0)}
                          className="w-full border border-amber-300 rounded px-1 py-0.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 mt-0.5"
                        />
                      ) : (
                        <p className="text-sm font-bold text-slate-800 mt-0.5">{vs.priceChanges24Mo}</p>
                      )}
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">Avg Change %</p>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">
                        {typeof vs.avgChangePercent === 'number' && Number.isFinite(vs.avgChangePercent)
                          ? `${vs.avgChangePercent.toFixed(1)}%`
                          : 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">Last change</p>
                      {editMode ? (
                        <input
                          value={vs.lastChangeDate}
                          onChange={e => updateVerticalSummary(i, 'lastChangeDate', e.target.value)}
                          className="w-full border border-amber-300 rounded px-1 py-0.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 mt-0.5"
                        />
                      ) : (
                        <p className="text-sm font-bold text-slate-800 mt-0.5">{vs.lastChangeDate}</p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 mb-3">
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">Total change (24 mo)</p>
                    {editMode ? (
                      <input
                        type="text"
                        value={
                          typeof vs.totalChangePercent === 'number' && Number.isFinite(vs.totalChangePercent)
                            ? String(vs.totalChangePercent)
                            : ''
                        }
                        onChange={e => {
                          const val = e.target.value
                          updateVerticalSummary(i, 'totalChangePercent', val === '' ? null : parseFloat(val) || 0)
                        }}
                        placeholder="e.g. 12.5"
                        className="w-full border border-amber-300 rounded px-1 py-0.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 mt-0.5"
                      />
                    ) : (
                      <p className="text-sm font-bold text-slate-800 mt-0.5">
                        {typeof vs.totalChangePercent === 'number' && Number.isFinite(vs.totalChangePercent)
                          ? `${vs.totalChangePercent.toFixed(1)}%`
                          : 'N/A'}
                      </p>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Flags — Keep / Decline triage (same pattern as WS2 add-back flags) */}
        <Card className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Pricing Flags</h3>
          <p className="text-xs text-slate-500 mb-3">Keep acknowledges the flag; Decline removes it from this view and from the exported PDF.</p>
          <div className="space-y-2">
            {result.flags
              .filter(f => f.resolution !== 'declined')
              .map(flag => (
                <div
                  key={flag.id}
                  className={cn(
                    'rounded-lg border px-4 py-3',
                    flag.severity === 'critical' && 'bg-red-50 border-red-200',
                    flag.severity === 'warning' && 'bg-amber-50 border-amber-200',
                    flag.severity === 'positive' && 'bg-emerald-50 border-emerald-200',
                    flag.severity === 'informational' && 'bg-blue-50 border-blue-200',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge color={SEVERITY_COLORS[flag.severity] ?? 'slate'}>{flag.severity}</Badge>
                        <span className="text-xs font-semibold text-slate-800">{flag.title}</span>
                        {flag.resolution === 'kept' && (
                          <Badge color="green" className="text-[10px]">Kept</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-600">{flag.description}</p>
                    </div>
                    {!flag.resolution && (
                      <div className="flex flex-shrink-0 gap-2">
                        <Button size="sm" variant="outline" onClick={() => resolvePricingFlag(flag.id, 'kept')}>
                          Keep
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => resolvePricingFlag(flag.id, 'declined')}>
                          Decline
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            {result.flags.filter(f => f.resolution !== 'declined').length === 0 && (
              <p className="text-sm text-slate-400">
                {result.flags.length === 0 ? 'No flags identified.' : 'All flags were declined.'}
              </p>
            )}
          </div>
        </Card>

        {/* Delete Confirmation Modal */}
        <DeleteConfirmModal
          open={deleteModalOpen}
          title="Delete Pricing by Vertical Analysis?"
          description="This will permanently delete the current pricing by vertical analysis report from this client record. The underlying website URL and document files will remain intact."
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

  // ── Analyzing / Processing loading view ───────────────────────────────────
  if (analyzing) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
              Pricing by Vertical Analysis
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Building 24-month rate card model for <span className="font-medium text-slate-700">{clientName}</span>...
            </p>
          </div>
        </div>

        {!readOnly && (
          <AgentRunToolbar
            provider={provider}
            onProviderChange={setProvider}
            disabled={true}
            historyItems={historyItems}
            activeId={activeId}
            onSelectRun={selectRun}
            activeProvider={activeRun?.aiProvider}
            activeModel={activeRun?.aiModel}
            activeVersion={activeRun?.version}
          />
        )}
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">Finding Current Prices &amp; Building Grid...</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Scraping current rate cards from website, analyzing uploaded pricing schedules and revenue breakdowns, and constructing the 24-month pricing model for {clientName}.
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-800 text-[11px] font-semibold border border-indigo-200">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> Analysis in progress
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const pricingDocs = uploadedDocs.filter(d => d.documentId === 'pricing_schedule')
  const revenueDocs = uploadedDocs.filter(d => d.documentId === 'revenue_breakdown')
  const satisfiedCount = (pricingDocs.length > 0 ? 1 : 0) + (revenueDocs.length > 0 ? 1 : 0)
  const canAnalyze = satisfiedCount > 0 || Boolean(websiteUrl?.trim())

  // ── Starting Workspace View ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Unified Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            Pricing by Vertical Analysis
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Scrape current website prices, model historical changes, and build an editable 24-month price grid across all service verticals for{' '}
            <span className="font-medium text-slate-700">{clientName}</span>.
          </p>
        </div>

        {!readOnly && result && composingNew && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setComposingNew(false)}
            className="h-8 text-xs cursor-pointer border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Cancel &amp; Return to Report
          </Button>
        )}
      </div>

      {/* Toolbar */}
      {!readOnly && (
        <AgentRunToolbar
          provider={provider}
          onProviderChange={setProvider}
          disabled={analyzing}
          historyItems={historyItems}
          activeId={activeId}
          onSelectRun={selectRun}
          activeProvider={activeRun?.aiProvider}
          activeModel={activeRun?.aiModel}
          activeVersion={activeRun?.version}
        />
      )}

      {/* Main Workspace Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
        {/* Top Informational Copy */}
        <p className="text-xs text-slate-500">
          The Pricing by Vertical Agent scrapes publicly available rate cards from the client&apos;s business website (prefetched from Digital Presence &amp; Client Portal) and analyzes uploaded rate schedules from Documents. It constructs an editable 24-month historical pricing grid across boarding, daycare, grooming, and training, identifying price increases and margin impact.
        </p>

        {/* Card: Business Website */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Business Website (From Digital Presence / Client Portal)
              </span>
            </div>
            {websiteDetectedFrom === 'digitalPresence' && websiteUrl && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Auto-filled from Digital Presence
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <input
                type="url"
                value={websiteUrl}
                onChange={e => {
                  setWebsiteUrl(e.target.value)
                  setWebsiteDetectedFrom(null)
                }}
                placeholder="https://example.com/pricing"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            {websiteUrl && (
              <button
                type="button"
                onClick={() => {
                  setWebsiteUrl('')
                  setWebsiteDetectedFrom(null)
                }}
                className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors shrink-0 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            The agent crawls this website to scrape current rate cards, peak season surcharges, and package pricing across boarding, daycare, grooming, and training.
          </p>
        </div>

        {/* Sector Header: Required Pricing & Revenue Documents */}
        <div className="space-y-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Required Pricing &amp; Revenue Documents
              </span>
              <span
                className={cn(
                  'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                  satisfiedCount === 2
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : satisfiedCount > 0
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200',
                )}
              >
                {satisfiedCount} of 2 uploaded
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
            Review documents uploaded by the client or upload files directly. Both documents are required for comprehensive pricing by vertical analysis.
          </p>
        </div>

        {/* Document Card List */}
        <div className="space-y-3">
          {PRICING_DOCUMENT_SLOTS.map(slot => (
            <PricingSlotRow
              key={slot.key}
              slot={slot}
              docs={uploadedDocs.filter(d => d.documentId === slot.documentId)}
              onUpload={handleUploadDoc}
              onDelete={handleDeleteDoc}
              uploading={uploadingSlot === slot.documentId}
              readOnly={readOnly}
            />
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-4 py-3 rounded-lg">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            {error}
          </div>
        )}

        {/* Readiness Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="w-full sm:w-auto">
            {satisfiedCount === 2 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  All 2 required documents ready{websiteUrl ? ' &bull; Website linked' : ''}. You can start the analysis.
                </span>
              </div>
            ) : satisfiedCount > 0 || websiteUrl ? (
              <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {satisfiedCount} of 2 documents ready{websiteUrl ? ' &bull; Website linked' : ''}. Ready to build pricing grid.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-amber-800 font-medium">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Upload required pricing documents or provide business website to run analysis.</span>
              </div>
            )}
          </div>

          <div className="w-full sm:w-auto flex items-center justify-end gap-3">
            <Button
              type="button"
              disabled={!canAnalyze || analyzing}
              onClick={handleAnalyze}
              className={cn(
                'h-10 px-5 rounded-lg font-medium text-xs text-white shadow-xs inline-flex items-center gap-2 cursor-pointer transition-all',
                'bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Building Pricing Grid...</span>
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4 text-white" />
                  <span>Build Pricing Grid</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        title="Delete Pricing by Vertical Analysis?"
        description="This will permanently delete the current pricing by vertical analysis report from this client record. The underlying website URL and document files will remain intact."
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
