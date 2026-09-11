'use client'

import { useState, useCallback, useEffect, useRef, Fragment } from 'react'
import {
  AlertTriangle,
  RefreshCw,
  Save,
  Pencil,
  TrendingUp,
  DollarSign,
  BarChart3,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Building2,
  Globe,
  FileText,
} from 'lucide-react'
import { Card, Badge, cn, Button } from '@/components/ui'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import type { CompetitorPricingInput, PricingAnalysisReport, PriceMatrixRow, PricingSummaryRow, PricingFlag } from '@/lib/pricing-analysis/types'
import {
  getCompetitorNamesFromReport,
  hasPricingTableData,
  normalizePricingReport,
} from '@/lib/pricing-analysis/normalize-report'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { AdvisorActions } from '@/components/client-portal/AgentClientPortalFrame'
import { buildPricingAnalysisReportHtml } from '@/lib/report-export/build-pricing-analysis-report'
import {
  groupRowsByPricingVertical,
  PRICING_SERVICE_VERTICAL_ORDER,
  classifyPricingService,
  type PricingServiceVertical,
} from '@/lib/pricing-analysis/service-vertical'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'

const STATUS_COLORS: Record<string, { badge: 'red' | 'green' | 'blue' | 'slate'; label: string }> = {
  underpriced: { badge: 'red', label: 'Underpriced' },
  'at-market': { badge: 'green', label: 'At Market' },
  premium: { badge: 'blue', label: 'Premium' },
  unknown: { badge: 'slate', label: 'Unknown' },
}

const SEVERITY_COLORS: Record<string, 'red' | 'gold' | 'green' | 'blue'> = {
  critical: 'red',
  warning: 'gold',
  positive: 'green',
  informational: 'blue',
}

const EMPTY_PRICE_DISPLAY = '--'

function isEmptyPriceDisplay(value: string): boolean {
  const t = value.trim()
  return !t || t === EMPTY_PRICE_DISPLAY || t === '—' || t.toLowerCase() === 'n/a'
}

function formatPriceDisplay(value: string): string {
  return isEmptyPriceDisplay(value) ? EMPTY_PRICE_DISPLAY : value
}

function editPriceValue(value: string): string {
  return isEmptyPriceDisplay(value) ? '' : value
}

function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isDeleting?: boolean
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
            <h3 className="text-base font-semibold text-slate-900">Delete Competitive Pricing Report?</h3>
            <p className="text-xs text-slate-500">
              This will permanently remove the competitive pricing analysis for this client. You will need to re-run the analysis to regenerate it.
            </p>
          </div>
        </div>
        <div className="flex border-t border-slate-100 p-3 gap-2 bg-slate-50/50 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isDeleting} className="h-8 text-xs cursor-pointer">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-8 text-xs bg-rose-600 text-white hover:bg-rose-700 border-none cursor-pointer"
          >
            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
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
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200',
        type === 'success'
          ? 'bg-emerald-950 text-emerald-100 border-emerald-800/60'
          : 'bg-rose-950 text-rose-100 border-rose-800/60',
      )}
    >
      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      <span>{message}</span>
    </div>
  )
}

// ── Editable Cell helper ────────────────────────────────────────────────────
function EditableCell({
  value,
  onChange,
  editMode,
  className,
  align = 'left',
}: {
  value: string
  onChange: (val: string) => void
  editMode: boolean
  className?: string
  align?: 'left' | 'right'
}) {
  if (!editMode) {
    return (
      <span
        className={cn(
          'block max-w-[18rem] whitespace-normal break-words text-slate-700',
          align === 'right' && 'ml-auto text-right',
          className,
        )}
      >
        {formatPriceDisplay(value)}
      </span>
    )
  }
  return (
    <input
      type="text"
      value={editPriceValue(value)}
      placeholder={EMPTY_PRICE_DISPLAY}
      onChange={e => onChange(e.target.value)}
      className={cn(
        'w-full min-w-[8rem] bg-white border border-amber-300 text-xs text-slate-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400',
        align === 'right' && 'text-right',
        className,
      )}
    />
  )
}

function makeEmptyMatrixRow(competitorNames: string[], defaultService = ''): PriceMatrixRow {
  return {
    service: defaultService,
    basis: '',
    sellerPrice: '',
    sellerNormalized: '',
    sellerNormalizedNumeric: null,
    competitors: competitorNames.map(name => ({
      name,
      listedPrice: '',
      normalized: '',
      normalizedNumeric: null,
      normalizationNote: '',
    })),
  }
}

function makeEmptySummaryRow(): PricingSummaryRow {
  return {
    service: '',
    sellerPrice: '',
    sellerPriceNumeric: null,
    competitorAvg: '',
    competitorAvgNumeric: null,
    variance: '',
    variancePercent: null,
    status: 'unknown',
    estAnnualUplift: '',
  }
}

export default function PricingAnalysisTab({
  clientId,
  clientName,
  readOnly = false,
}: {
  clientId: string
  clientName: string
  readOnly?: boolean
}) {
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PricingAnalysisReport | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedBadge, setSavedBadge] = useState(false)
  const [rerunComplete, setRerunComplete] = useState(false)
  const [sellerWebsiteUrl, setSellerWebsiteUrl] = useState('')
  const [sellerManualPricingText, setSellerManualPricingText] = useState('')
  const [competitors, setCompetitors] = useState<CompetitorPricingInput[]>(
    Array.from({ length: 5 }, () => ({ name: '', websiteUrl: '' })),
  )
  const [savingInputs, setSavingInputs] = useState(false)
  const [inputsSaved, setInputsSaved] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadingInputs, setLoadingInputs] = useState(false)
  const [showManualEvidence, setShowManualEvidence] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const lastSavedSnapshotRef = useRef<string>('')
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { provider, setProvider } = useAgentAiProvider()
  const {
    runs,
    historyItems,
    activeRun,
    activeId,
    setActiveId,
    reload: reloadRuns,
    loading: loadingRuns,
  } = useGenericAgentRuns(clientId, AGENT_RUN_KEYS.pricingAnalysis)

  useEffect(() => {
    if (!readOnly) return
    setEditMode(false)
  }, [readOnly])

  const markSavedSnapshot = useCallback((report: PricingAnalysisReport) => {
    lastSavedSnapshotRef.current = JSON.stringify(report)
  }, [])

  const persistPricingAnalysisToServer = useCallback(
    async (report: PricingAnalysisReport, options: { silent: boolean }) => {
      if (!options.silent) setSaving(true)
      else setAutoSaveStatus('saving')
      try {
        const res = await fetch(`/api/client-data/${clientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'pricingAnalysis', data: report }),
        })
        if (!res.ok) throw new Error('Save failed')
        markSavedSnapshot(report)
        if (!options.silent) {
          setSavedBadge(true)
          setTimeout(() => setSavedBadge(false), 2000)
        } else {
          setAutoSaveStatus('saved')
          setTimeout(() => setAutoSaveStatus('idle'), 2500)
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Save failed'
        setError(message)
        if (options.silent) setAutoSaveStatus('error')
      } finally {
        if (!options.silent) setSaving(false)
      }
    },
    [clientId, markSavedSnapshot],
  )

  const applyPortalPrefill = useCallback((prefill: {
    sellerWebsiteUrl?: string
    sellerManualPricingText?: string
    competitors?: CompetitorPricingInput[]
  } | null | undefined) => {
    if (!prefill) return
    setSellerWebsiteUrl(prefill.sellerWebsiteUrl ?? '')
    setSellerManualPricingText(prefill.sellerManualPricingText ?? '')
    const prefillCompetitors = [...(prefill.competitors ?? [])].slice(0, 5)
    setCompetitors(Array.from({ length: 5 }, (_, index) => prefillCompetitors[index] ?? { name: '', websiteUrl: '' }))
  }, [])

  // Load saved report + always prefill portal inputs (even when a prior run exists)
  useEffect(() => {
    if (loadingRuns) return
    let cancelled = false

    const loadSaved = async () => {
      try {
        if (activeRun?.report) {
          const normalized = normalizePricingReport(activeRun.report)
          if (normalized && !cancelled) {
            setResult(normalized)
            markSavedSnapshot(normalized)
          }
        }

        const res = await fetch(`/api/pricing-analysis?clientId=${encodeURIComponent(clientId)}&includePrefill=1`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return

        // Only hydrate result from sectionSubmissions when history did not already supply one
        if (!activeRun?.report) {
          const normalized = normalizePricingReport(data?.report)
          if (normalized) {
            setResult(normalized)
            markSavedSnapshot(normalized)
          }
        }
        applyPortalPrefill(data?.prefill)
      } catch { /* ignore */ }
      finally {
        if (!cancelled) setInitialLoading(false)
      }
    }

    void loadSaved()
    return () => {
      cancelled = true
    }
  }, [clientId, markSavedSnapshot, activeRun, loadingRuns, applyPortalPrefill])

  const refreshInputs = async (options?: { silent?: boolean }) => {
    setLoadingInputs(true)
    try {
      const res = await fetch(`/api/pricing-analysis?clientId=${encodeURIComponent(clientId)}&includePrefill=1`)
      if (res.ok) {
        const data = await res.json()
        applyPortalPrefill(data?.prefill)
        if (!options?.silent) {
          setToast({ message: 'Pricing benchmark targets refreshed from client portal', type: 'success' })
        }
      }
    } catch {
      if (!options?.silent) {
        setToast({ message: 'Failed to refresh inputs', type: 'error' })
      }
    } finally {
      setLoadingInputs(false)
    }
  }

  function selectRun(run: AgentRunHistoryItem) {
    setActiveId(run.id)
    const full = runs.find((item) => item.id === run.id)
    const normalized = normalizePricingReport(full?.report)
    if (normalized) {
      setResult(normalized)
      markSavedSnapshot(normalized)
    }
  }

  // Auto-save while editing (debounced) so refresh does not lose manual edits
  useEffect(() => {
    if (!editMode || !result) return
    const snapshot = JSON.stringify(result)
    if (snapshot === lastSavedSnapshotRef.current) return

    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    autoSaveTimeoutRef.current = setTimeout(() => {
      void persistPricingAnalysisToServer(result, { silent: true })
    }, 700)

    return () => {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    }
  }, [result, editMode, persistPricingAnalysisToServer])

  // Flush pending edits when the tab is hidden (e.g. user refreshes soon after typing)
  useEffect(() => {
    const flushIfDirty = () => {
      if (!editMode || !result) return
      if (JSON.stringify(result) === lastSavedSnapshotRef.current) return
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
      void persistPricingAnalysisToServer(result, { silent: true })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushIfDirty()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [editMode, result, persistPricingAnalysisToServer])

  const handleAnalyze = async () => {
    const completeCompetitors = competitors.filter(c => c.name.trim() && c.websiteUrl.trim())
    if (!sellerWebsiteUrl.trim()) {
      setError('Seller website URL is required.')
      return
    }
    if (completeCompetitors.length !== 5) {
      setError('All 5 competitor names and websites are required.')
      return
    }
    setAnalyzing(true)
    setError(null)
    try {
      const res = await fetch('/api/pricing-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          sellerWebsiteUrl: sellerWebsiteUrl.trim(),
          sellerManualPricingText: sellerManualPricingText.trim(),
          competitors: completeCompetitors,
          provider,
          modelId: resolveAgentModelId(provider),
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Analysis failed (${res.status})`)
      }
      const data = normalizePricingReport(await res.json())
      if (!data) throw new Error('Analysis returned an invalid report. Please run again.')
      setResult(data)
      markSavedSnapshot(data)
      setEditMode(false)
      setRerunComplete(true)
      setTimeout(() => setRerunComplete(false), 3500)
      await saveAgentAnalysisRunClient({
        clientId,
        agentKey: AGENT_RUN_KEYS.pricingAnalysis,
        fileName: `${clientName} — Pricing Analysis`,
        report: data,
        aiProvider: provider,
        aiModel: resolveAgentModelId(provider),
      })
      await reloadRuns({ selectNewest: true })
    } catch (err: any) {
      setError(err.message || 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await fetch(`/api/pricing-analysis?clientId=${encodeURIComponent(clientId)}`, { method: 'DELETE' })
      setResult(null)
      setError(null)
      setEditMode(false)
      setDeleteModalOpen(false)
      setToast({ message: 'Pricing analysis report deleted', type: 'success' })
      await reloadRuns()
    } catch {
      setToast({ message: 'Failed to delete report', type: 'error' })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleNewAnalysis = () => {
    setResult(null)
    setEditMode(false)
    setError(null)
    // Re-pull Required Info targets so "+ New Analysis" is never blank after a prior run
    void refreshInputs({ silent: true })
  }

  const handleSave = async () => {
    if (!result) return
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
    await persistPricingAnalysisToServer(result, { silent: false })
  }

  // ── Mutation helpers ────────────────────────────────────────────────────────
  const updateMatrixRow = (index: number, field: keyof PriceMatrixRow, value: any) => {
    if (!result || index < 0 || index >= (result.priceMatrix ?? []).length) return
    const matrix = [...(result.priceMatrix ?? [])]
    matrix[index] = { ...matrix[index], [field]: value }
    setResult({ ...result, priceMatrix: matrix })
  }

  const updateMatrixCompetitor = (
    rowIndex: number,
    compName: string,
    field: 'listedPrice' | 'normalized' | 'normalizationNote',
    value: string,
  ) => {
    if (!result || rowIndex < 0 || rowIndex >= (result.priceMatrix ?? []).length) return
    const matrix = [...(result.priceMatrix ?? [])]
    const row = { ...matrix[rowIndex], competitors: [...(matrix[rowIndex].competitors ?? [])] }
    let compIndex = row.competitors.findIndex(c => c.name === compName)
    if (compIndex < 0) {
      row.competitors.push({
        name: compName,
        listedPrice: '',
        normalized: '',
        normalizedNumeric: null,
        normalizationNote: '',
      })
      compIndex = row.competitors.length - 1
    }
    row.competitors[compIndex] = { ...row.competitors[compIndex], [field]: value }
    matrix[rowIndex] = row
    setResult({ ...result, priceMatrix: matrix })
  }

  const addMatrixRow = (vertical?: PricingServiceVertical) => {
    if (!result) return
    const names = getCompetitorNamesFromReport(result)
    const defaultService =
      vertical && vertical !== 'Other'
        ? `${vertical} - `
        : ''
    setResult({
      ...result,
      priceMatrix: [...(result.priceMatrix ?? []), makeEmptyMatrixRow(names, defaultService)],
    })
  }

  const removeMatrixRow = (rowIndex: number) => {
    if (!result || rowIndex < 0 || rowIndex >= (result.priceMatrix ?? []).length) return
    const matrix = [...(result.priceMatrix ?? [])]
    matrix.splice(rowIndex, 1)
    setResult({ ...result, priceMatrix: matrix })
  }

  const addSummaryRow = () => {
    if (!result) return
    setResult({
      ...result,
      pricingSummary: [...(result.pricingSummary ?? []), makeEmptySummaryRow()],
    })
  }

  const removeSummaryRow = (rowIndex: number) => {
    if (!result || rowIndex < 0 || rowIndex >= (result.pricingSummary ?? []).length) return
    const summary = [...(result.pricingSummary ?? [])]
    summary.splice(rowIndex, 1)
    setResult({ ...result, pricingSummary: summary })
  }

  const addFlag = () => {
    if (!result) return
    setResult({
      ...result,
      flags: [
        ...(result.flags ?? []),
        {
          id: `flag-${Date.now()}`,
          severity: 'informational',
          title: '',
          description: '',
        },
      ],
    })
  }

  const updateSummaryRow = (index: number, field: keyof PricingSummaryRow, value: any) => {
    if (!result || index < 0 || index >= (result.pricingSummary ?? []).length) return
    const summary = [...(result.pricingSummary ?? [])]
    summary[index] = { ...summary[index], [field]: value }
    setResult({ ...result, pricingSummary: summary })
  }

  const updateCompetitor = (index: number, field: keyof CompetitorPricingInput, value: string) => {
    const next = [...competitors]
    next[index] = { ...next[index], [field]: value }
    setCompetitors(next)
  }

  const saveCompetitorInputs = async () => {
    setSavingInputs(true)
    setInputsSaved(false)
    setError(null)
    try {
      const res = await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'competitorPricingInputs',
          data: {
            sellerWebsiteUrl: sellerWebsiteUrl.trim(),
            sellerManualPricingText: sellerManualPricingText.trim(),
            competitors: competitors.filter(c => c.name.trim() || c.websiteUrl.trim()),
            updatedAt: new Date().toISOString(),
          },
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setInputsSaved(true)
      setToast({ message: 'Pricing targets saved successfully', type: 'success' })
      setTimeout(() => setInputsSaved(false), 2000)
    } catch (err: any) {
      setError(err.message || 'Save failed')
      setToast({ message: 'Failed to save inputs', type: 'error' })
    } finally {
      setSavingInputs(false)
    }
  }

  const updateFlag = (index: number, field: keyof PricingFlag, value: string) => {
    if (!result) return
    const flags = [...(result.flags ?? [])]
    flags[index] = { ...flags[index], [field]: value }
    setResult({ ...result, flags })
  }

  const removeFlag = (index: number) => {
    if (!result) return
    const flags = [...(result.flags ?? [])]
    flags.splice(index, 1)
    setResult({ ...result, flags })
  }

  const updateRecommendation = (index: number, value: string) => {
    if (!result) return
    const recs = [...(result.recommendations ?? [])]
    recs[index] = value
    setResult({ ...result, recommendations: recs })
  }

  const addRecommendation = () => {
    if (!result) return
    setResult({ ...result, recommendations: [...(result.recommendations ?? []), ''] })
  }

  const removeRecommendation = (index: number) => {
    if (!result) return
    const recs = [...(result.recommendations ?? [])]
    recs.splice(index, 1)
    setResult({ ...result, recommendations: recs })
  }

  const manualEvidencePanel = (
    <Card className="p-5">
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Manual Pricing Evidence</h3>
      <p className="text-xs text-slate-500 mb-4">
        If AI misses prices, paste copied website pricing text here. Run AI again and it will parse this text into the tables.
      </p>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-500">Seller pricing text</label>
          <textarea
            value={sellerManualPricingText}
            onChange={e => setSellerManualPricingText(e.target.value)}
            placeholder={'Full Day $62\nHalf Day $39\n10 Day Package $490\n20 Day Package $969'}
            rows={5}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {competitors.map((competitor, index) => (
            <div key={`manual-${index}`}>
              <label className="text-xs font-semibold text-slate-500">{competitor.name || `Competitor ${index + 1}`} pricing text</label>
              <textarea
                value={competitor.manualPricingText ?? ''}
                onChange={e => updateCompetitor(index, 'manualPricingText', e.target.value)}
                placeholder="Paste competitor pricing rows here..."
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          ))}
        </div>
      </div>
    </Card>
  )

  const competitorNames = result ? getCompetitorNamesFromReport(result) : []

  const normalizeMatrixForEdit = useCallback((report: PricingAnalysisReport): PricingAnalysisReport => {
    const names = getCompetitorNamesFromReport(report)
    if (!names.length) return report
    const priceMatrix = report.priceMatrix.map(row => {
      const byName = new Map(row.competitors.map(c => [c.name, c]))
      return {
        ...row,
        competitors: names.map(
          name =>
            byName.get(name) ?? {
              name,
              listedPrice: '',
              normalized: '',
              normalizedNumeric: null,
              normalizationNote: '',
            },
        ),
      }
    })
    return { ...report, priceMatrix }
  }, [])

  const toggleEditMode = async () => {
    if (editMode && result) {
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
      await persistPricingAnalysisToServer(result, { silent: false })
      setEditMode(false)
      return
    }
    if (result) {
      setResult(normalizeMatrixForEdit(result))
    }
    setEditMode(true)
  }

  // ── Results view ────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-6">
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
        {/* Header Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
              Competitive Pricing Analysis
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {clientName} &mdash; {result.competitorsAnalyzed} competitors analyzed &mdash; Generated{' '}
              {new Date(result.generatedAt).toLocaleString()}
            </p>
            {editMode && (
              <p className="text-[11px] text-amber-700/90 mt-1">
                Changes auto-save while you edit. Click <span className="font-semibold">Editing</span> when done to save immediately.
              </p>
            )}
          </div>

          <AdvisorActions className="flex items-center gap-2 shrink-0 flex-wrap">
            {editMode && autoSaveStatus === 'saving' && (
              <span className="text-xs text-slate-500">Saving…</span>
            )}
            {editMode && autoSaveStatus === 'saved' && (
              <span className="text-xs text-emerald-600 font-medium">All changes saved</span>
            )}
            {editMode && autoSaveStatus === 'error' && (
              <span className="text-xs text-red-600 font-medium">Save failed — use Save</span>
            )}
            {rerunComplete && (
              <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                Analysis updated
              </span>
            )}
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleEditMode}
                className={cn(
                  'h-8 text-xs cursor-pointer',
                  editMode && 'bg-amber-50 text-amber-700 border-amber-200',
                )}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" />
                {editMode ? 'Editing' : 'Edit'}
              </Button>
            )}
            {!readOnly && editMode && (
              <Button
                size="sm"
                onClick={handleAnalyze}
                disabled={analyzing}
                className="h-8 text-xs bg-slate-900 text-white hover:bg-slate-800 cursor-pointer"
              >
                <RotateCw className={cn('w-3.5 h-3.5 mr-1', analyzing && 'animate-spin')} />
                {analyzing ? 'Updating...' : 'Run AI Again'}
              </Button>
            )}
            {editMode && (
              <div className="relative">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="h-8 text-xs bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
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
              html={buildPricingAnalysisReportHtml(result, clientName)}
              fileName={`competitor-pricing-analysis-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
              label="Export Pricing Report"
            />
            {!readOnly && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewAnalysis}
                  className="h-8 text-xs cursor-pointer"
                >
                  + New Analysis
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteModalOpen(true)}
                  className="h-8 text-xs text-rose-600 hover:text-rose-700 border-rose-200 hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete
                </Button>
              </>
            )}
          </AdvisorActions>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {editMode && manualEvidencePanel}

        {!hasPricingTableData(result) && (
          <Card className="p-5 border-amber-200 bg-amber-50">
            <p className="text-sm font-semibold text-amber-900">Pricing tables need to be regenerated</p>
            <p className="text-xs text-amber-700 mt-1">
              This saved report uses an older format or is missing table data. Click <strong>Edit</strong>, then{' '}
              <strong>Run AI Again</strong> to rebuild the competitor matrix and summary.
            </p>
          </Card>
        )}

        {analyzing && result && (
          <Card className="p-5 border-amber-200 bg-amber-50">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-amber-700 animate-spin" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Re-running AI analysis</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Manual evidence is being parsed into the pricing tables and report.
                </p>
              </div>
            </div>
          </Card>
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

        {/* Table 1: Detailed Competitor Price Matrix — grouped by service vertical */}
        {(editMode || (result.priceMatrix ?? []).length > 0) && (
          <div className="space-y-4">
            {PRICING_SERVICE_VERTICAL_ORDER.map(vertical => {
              const groupedRows = groupRowsByPricingVertical(result.priceMatrix ?? [])[vertical]
              if (!editMode && groupedRows.length === 0) return null

              return (
                <Card key={vertical} className="overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-slate-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        {vertical}
                      </h3>
                      {!editMode && groupedRows.length === 0 && (
                        <span className="text-[10px] text-slate-400">No services in this section</span>
                      )}
                    </div>
                    {editMode && (
                      <button
                        type="button"
                        onClick={() => addMatrixRow(vertical)}
                        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium px-2 py-1 rounded hover:bg-amber-50 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add row
                      </button>
                    )}
                  </div>
                  {(editMode || groupedRows.length > 0) && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/50">
                            <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Service</th>
                            <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Basis</th>
                            <th className="text-right px-3 py-2.5 font-semibold text-slate-600 bg-yellow-50">Your Price</th>
                            {competitorNames.map(name => (
                              <th key={`${vertical}-${name}-listed`} className="text-center px-3 py-2.5 font-semibold text-slate-600 bg-emerald-50 border-l border-slate-100">
                                {name}
                              </th>
                            ))}
                          </tr>
                          <tr className="border-b border-slate-200 bg-slate-50/30">
                            <th className="px-3 py-1" />
                            <th className="px-3 py-1" />
                            <th className="px-3 py-1 bg-yellow-50" />
                            {competitorNames.map(name => (
                              <Fragment key={`${vertical}-${name}-sub`}>
                                <th className="text-right px-3 py-1 text-[10px] font-medium text-slate-400 bg-emerald-50 border-l border-slate-100">Price</th>
                              </Fragment>
                            ))}
                            {editMode && <th className="w-10 px-2 py-1" />}
                          </tr>
                        </thead>
                        <tbody>
                          {groupedRows.map((row) => {
                            const ri = (result.priceMatrix ?? []).indexOf(row)
                            const compMap = new Map(row.competitors.map(c => [c.name, c]))
                            return (
                              <tr key={`${vertical}-${ri}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                                <td className="px-3 py-2.5 font-medium text-slate-800">
                                  <EditableCell value={row.service} onChange={v => updateMatrixRow(ri, 'service', v)} editMode={editMode} />
                                </td>
                                <td className="px-3 py-2.5 text-slate-600">
                                  <EditableCell value={row.basis} onChange={v => updateMatrixRow(ri, 'basis', v)} editMode={editMode} />
                                </td>
                                <td className="px-3 py-2.5 text-right font-semibold bg-yellow-50 text-slate-900">
                                  <EditableCell value={row.sellerPrice} onChange={v => updateMatrixRow(ri, 'sellerPrice', v)} editMode={editMode} align="right" />
                                </td>
                                {competitorNames.map(name => {
                                  const comp = compMap.get(name)
                                  return (
                                    <Fragment key={`${vertical}-${name}-${ri}`}>
                                      <td className="px-3 py-2.5 text-right bg-emerald-50/50 text-slate-700 border-l border-slate-100">
                                        <EditableCell
                                          value={comp?.listedPrice ?? ''}
                                          onChange={v => updateMatrixCompetitor(ri, name, 'listedPrice', v)}
                                          editMode={editMode}
                                          align="right"
                                        />
                                      </td>
                                    </Fragment>
                                  )
                                })}
                                {editMode && (
                                  <td className="px-2 py-2.5 text-center">
                                    <button
                                      type="button"
                                      onClick={() => removeMatrixRow(ri)}
                                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-all"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                          {editMode && groupedRows.length === 0 && (
                            <tr>
                              <td colSpan={3 + competitorNames.length + (editMode ? 1 : 0)} className="px-4 py-6 text-center text-sm text-slate-400">
                                No {vertical.toLowerCase()} services yet. Click &ldquo;Add row&rdquo; above to add one.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {/* Table 2: Pricing Summary & Variance */}
        {(editMode || (result.pricingSummary ?? []).length > 0) && (
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Pricing Summary & Variance
                </h3>
              </div>
              {editMode && (
                <button
                   type="button"
                   onClick={addSummaryRow}
                   className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add row
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Service</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Your Price</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Comp. Average</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Variance</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-slate-600">Status</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600 font-medium opacity-50 select-none pointer-events-none hidden">Est. Annual Uplift</th>
                    {editMode && <th className="w-10 px-2 py-2.5" />}
                  </tr>
                </thead>
                <tbody>
                  {(result.pricingSummary ?? []).map((row, i) => {
                    const statusConfig = STATUS_COLORS[row.status] || STATUS_COLORS.unknown
                    return (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          <EditableCell value={row.service} onChange={v => updateSummaryRow(i, 'service', v)} editMode={editMode} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <EditableCell value={row.sellerPrice} onChange={v => updateSummaryRow(i, 'sellerPrice', v)} editMode={editMode} align="right" />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <EditableCell value={row.competitorAvg} onChange={v => updateSummaryRow(i, 'competitorAvg', v)} editMode={editMode} align="right" />
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold">
                          <EditableCell
                            value={row.variance}
                            onChange={v => updateSummaryRow(i, 'variance', v)}
                            editMode={editMode}
                            align="right"
                            className={
                              !editMode && row.variancePercent !== null && row.variancePercent < -10
                                ? 'text-red-600'
                                : !editMode && row.variancePercent !== null && row.variancePercent > 15
                                  ? 'text-blue-600'
                                  : !editMode
                                    ? 'text-emerald-600'
                                    : undefined
                            }
                          />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {editMode ? (
                            <select
                              value={row.status}
                              onChange={e => updateSummaryRow(i, 'status', e.target.value)}
                              className="bg-white border border-amber-300 text-xs text-slate-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
                            >
                              <option value="underpriced">Underpriced</option>
                              <option value="at-market">At Market</option>
                              <option value="premium">Premium</option>
                              <option value="unknown">Unknown</option>
                            </select>
                          ) : (
                            <Badge color={statusConfig.badge}>{statusConfig.label}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right hidden">
                          <EditableCell value={row.estAnnualUplift} onChange={v => updateSummaryRow(i, 'estAnnualUplift', v)} editMode={editMode} align="right" />
                        </td>
                        {editMode && (
                          <td className="px-2 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeSummaryRow(i)}
                              className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {editMode && (result.pricingSummary ?? []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                        No summary rows yet. Click &ldquo;Add row&rdquo; to add one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Pricing Comparison Charts */}
        {(!editMode && (result.priceMatrix ?? []).length > 0) && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Pricing Comparison Charts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['Boarding', 'Daycare', 'Grooming', 'Training'].map(vertical => {
                const verticalRows = (result.priceMatrix ?? []).filter(row => classifyPricingService(row.service) === vertical)
                if (verticalRows.length === 0) return null

                return (
                  <Card key={vertical} className="p-5 space-y-4">
                    <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wide">{vertical} Price Comparison</h4>
                    <div className="space-y-4">
                      {verticalRows.map((row, idx) => {
                        const parseVal = (val: string) => {
                          const num = parseFloat(val.replace(/[^0-9.]/g, ''))
                          return isNaN(num) ? 0 : num
                        }
                        const yourVal = parseVal(row.sellerPrice)
                        const compVals = row.competitors.map(c => ({ name: c.name, val: parseVal(c.listedPrice) }))
                        const maxVal = Math.max(yourVal, ...compVals.map(c => c.val), 1)

                        return (
                          <div key={idx} className="space-y-2 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                            <div className="text-xs font-semibold text-slate-800">{row.service} ({row.basis})</div>
                            {/* Your Price bar */}
                            <div className="flex items-center gap-2">
                              <div className="w-24 text-[10px] text-slate-500 truncate font-medium">Your Price</div>
                              <div className="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-amber-500"
                                  style={{ width: `${(yourVal / maxVal) * 100}%` }}
                                />
                              </div>
                              <div className="text-[10px] font-bold text-slate-700 w-12 text-right">${yourVal}</div>
                            </div>
                            {/* Competitors bars */}
                            {compVals.map((cv, ci) => (
                              <div key={ci} className="flex items-center gap-2">
                                <div className="w-24 text-[10px] text-slate-400 truncate">{cv.name}</div>
                                <div className="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-slate-400"
                                    style={{ width: `${(cv.val / maxVal) * 100}%` }}
                                  />
                                </div>
                                <div className="text-[10px] text-slate-600 w-12 text-right">${cv.val || 'N/A'}</div>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* Flags */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Pricing Flags</h3>
            {editMode && (
              <button type="button" onClick={addFlag} className="text-xs text-amber-600 hover:text-amber-800 font-medium">
                + Add flag
              </button>
            )}
          </div>
          <div className="space-y-2">
            {(result.flags ?? []).map((flag, i) => (
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
                <div className="flex items-center gap-2 mb-1">
                  <Badge color={SEVERITY_COLORS[flag.severity] ?? 'slate'}>{flag.severity}</Badge>
                  {editMode ? (
                    <input
                      value={flag.title}
                      onChange={e => updateFlag(i, 'title', e.target.value)}
                      className="flex-1 border border-amber-300 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-slate-800">{flag.title}</span>
                  )}
                  {editMode && (
                    <button
                      onClick={() => removeFlag(i)}
                      className="ml-auto rounded border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-white"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {editMode ? (
                  <input
                    value={flag.description}
                    onChange={e => updateFlag(i, 'description', e.target.value)}
                    className="w-full border border-amber-300 rounded px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                ) : (
                  <p className="text-xs text-slate-600">{flag.description}</p>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Recommendations */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Recommendations</h3>
            {editMode && (
              <button onClick={addRecommendation} className="text-xs text-amber-600 hover:text-amber-800 font-medium">
                + Add Recommendation
              </button>
            )}
          </div>
          <ol className="space-y-2">
            {(result.recommendations ?? []).map((rec, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {editMode ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={rec}
                      onChange={e => updateRecommendation(i, e.target.value)}
                      className="flex-1 border border-amber-300 rounded px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button onClick={() => removeRecommendation(i)} className="text-red-400 hover:text-red-600 text-xs">
                      &times;
                    </button>
                  </div>
                ) : (
                  rec
                )}
              </li>
            ))}
          </ol>
        </Card>
        <DeleteConfirmModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDelete}
          isDeleting={isDeleting}
        />
        {toast && (
          <StatusToast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </div>
    )
  }

  // ── Loading Gate ──
  if (initialLoading || loadingRuns) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-amber-200 border-t-amber-600 rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Loading pricing analysis…</p>
        </div>
      </div>
    )
  }

  // ── Read-Only Gate ──
  const readOnlyGate = agentTabReadOnlyGate(
    readOnly,
    initialLoading || loadingRuns,
    Boolean(result),
    'Competitive Pricing Analysis',
  )
  if (readOnlyGate) return readOnlyGate

  // ── Analyzing Spinner ──
  if (analyzing && !result) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 shadow-2xs text-center space-y-6">
        <div className="w-12 h-12 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto" />
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-900">
            Benchmarking Competitive Pricing…
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Extracting public rates and plans across {clientName} and 5 named competitors. This typically takes 1-2 minutes.
          </p>
        </div>
      </div>
    )
  }

  const readyCompetitorCount = competitors.filter(c => c.name.trim() && c.websiteUrl.trim()).length
  const hasSellerUrl = Boolean(sellerWebsiteUrl.trim())
  const canAnalyze = hasSellerUrl && readyCompetitorCount === 5

  // ── Workspace / Input View ───────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            Competitive Pricing Analysis
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Direct pricing and services comparison across 5 named competitors for {clientName}
          </p>
        </div>
      </div>

      {/* AI Provider Toolbar */}
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
        {/* Card Title Block */}
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Pricing Benchmark Targets
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            No document upload required. Competitor names and pricing page URLs are prefilled automatically from the <strong>Required Information</strong> form submitted in the Client Portal. You can verify, fine-tune, or manually override URLs below before running analysis.
          </p>
        </div>

        {/* Sector Header / Readiness Bar */}
        <div className="pt-2 border-t border-slate-100 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              PRICING BENCHMARK TARGETS
            </h4>
            <span
              className={cn(
                'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                readyCompetitorCount === 5 && hasSellerUrl
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-600',
              )}
            >
              {readyCompetitorCount} of 5 competitors ready
            </span>
            <span
              className={cn(
                'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                hasSellerUrl
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200',
              )}
            >
              {hasSellerUrl ? 'Seller URL Ready' : 'Seller URL Missing'}
            </span>
          </div>

          <button
            onClick={() => void refreshInputs()}
            disabled={loadingInputs}
            className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <RotateCw className={cn('w-3 h-3', loadingInputs && 'animate-spin')} />
            Refresh from Portal
          </button>
        </div>

        {/* Information Banner */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
            <Globe className="w-4 h-4" />
          </div>
          <div className="text-xs space-y-1">
            <div className="font-semibold text-slate-800">
              Automated Live Pricing Extraction
            </div>
            <p className="text-slate-600 leading-relaxed">
              The AI agent crawls live public pricing tables from the seller and all 5 competitor websites. Provide direct links to pricing or service plans pages where possible (e.g., <code className="text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">https://domain.com/pricing</code>) for maximum extraction accuracy.
            </p>
          </div>
        </div>

        {/* Target Cards */}
        <div className="space-y-4">
          {/* Card 1: Seller Pricing URL */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-4 mb-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 truncate">
                      Seller Website / Pricing Page URL
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                      Required
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    {clientName}&apos;s public pricing, rate card, or service catalog URL
                  </p>
                </div>
              </div>
              {hasSellerUrl && (
                <a
                  href={sellerWebsiteUrl.trim().startsWith('http') ? sellerWebsiteUrl.trim() : `https://${sellerWebsiteUrl.trim()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Visit
                </a>
              )}
            </div>

            <div className="relative">
              <input
                type="url"
                value={sellerWebsiteUrl}
                onChange={e => setSellerWebsiteUrl(e.target.value)}
                placeholder="https://seller-website.com/pricing"
                className="w-full text-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-mono"
              />
            </div>
          </div>

          {/* Card 2: 5 Competitor Targets */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Competitor Pricing Targets
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                      5 Required
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Named direct competitors and their public pricing URLs from Client Portal Required Info
                  </p>
                </div>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {readyCompetitorCount} / 5 ready
              </span>
            </div>

            <div className="space-y-2.5">
              {competitors.map((competitor, idx) => {
                const isReady = Boolean(competitor.name.trim() && competitor.websiteUrl.trim())
                const formattedUrl = competitor.websiteUrl.trim().startsWith('http') 
                  ? competitor.websiteUrl.trim() 
                  : `https://${competitor.websiteUrl.trim()}`

                return (
                  <div
                    key={idx}
                    className={cn(
                      'p-3 rounded-lg border transition-all flex flex-col md:flex-row md:items-center gap-3',
                      isReady
                        ? 'border-slate-200 bg-slate-50/50'
                        : 'border-amber-200/80 bg-amber-50/20',
                    )}
                  >
                    <div className="flex items-center gap-2.5 md:w-8 shrink-0">
                      <span
                        className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                          isReady
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600',
                        )}
                      >
                        {idx + 1}
                      </span>
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                          Competitor {idx + 1} Name
                        </label>
                        <input
                          type="text"
                          value={competitor.name}
                          onChange={e => updateCompetitor(idx, 'name', e.target.value)}
                          placeholder={`e.g. Competitor ${idx + 1} Name`}
                          className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                            Pricing Page URL
                          </label>
                          {competitor.websiteUrl.trim() && (
                            <a
                              href={formattedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-slate-400 hover:text-slate-700 inline-flex items-center gap-0.5"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              Visit
                            </a>
                          )}
                        </div>
                        <input
                          type="url"
                          value={competitor.websiteUrl}
                          onChange={e => updateCompetitor(idx, 'websiteUrl', e.target.value)}
                          placeholder="https://competitor.com/pricing"
                          className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="hidden md:flex items-center justify-center shrink-0 w-8">
                      {isReady ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-amber-400" title="Incomplete" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Optional: Manual Pricing Evidence Accordion */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setShowManualEvidence(!showManualEvidence)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Manual Pricing Evidence &amp; Text Override
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      Optional
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Paste copied rate cards, menus, or raw pricing text if websites have dynamic scripts or paywalls
                  </p>
                </div>
              </div>
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-slate-400 transition-transform duration-200',
                  showManualEvidence && 'rotate-180',
                )}
              />
            </button>

            {showManualEvidence && (
              <div className="p-4 pt-1 border-t border-slate-100 space-y-4 bg-slate-50/30">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    {clientName} Pricing Text
                  </label>
                  <textarea
                    value={sellerManualPricingText}
                    onChange={e => setSellerManualPricingText(e.target.value)}
                    placeholder={'Full Day $62\nHalf Day $39\n10 Day Package $490\n20 Day Package $969'}
                    rows={4}
                    className="w-full text-xs rounded-lg border border-slate-200 bg-white p-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {competitors.map((competitor, idx) => (
                    <div key={`manual-evidence-${idx}`}>
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                        {competitor.name.trim() || `Competitor ${idx + 1}`} Pricing Text
                      </label>
                      <textarea
                        value={competitor.manualPricingText ?? ''}
                        onChange={e => updateCompetitor(idx, 'manualPricingText', e.target.value)}
                        placeholder="Paste raw pricing rows or table text..."
                        rows={3}
                        className="w-full text-xs rounded-lg border border-slate-200 bg-white p-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-4 py-3 rounded-lg">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Footer */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            {canAnalyze ? (
              <span className="text-xs text-emerald-700 font-medium inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Seller URL and all 5 competitor benchmarks are configured and ready.
              </span>
            ) : (
              <span className="text-xs text-amber-700 font-medium inline-flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                {!hasSellerUrl
                  ? 'Seller website URL is required.'
                  : `${5 - readyCompetitorCount} more competitor benchmark${5 - readyCompetitorCount !== 1 ? 's' : ''} (name & URL) required.`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={saveCompetitorInputs}
              disabled={savingInputs}
              className="h-9 px-4 text-xs font-medium cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {savingInputs ? 'Saving...' : inputsSaved ? 'Saved' : 'Save Inputs'}
            </Button>

            <Button
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing || !canAnalyze}
              className={cn(
                'h-9 px-5 text-xs font-semibold cursor-pointer border-none shadow-xs transition-all',
                canAnalyze && !analyzing
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed',
              )}
            >
              {analyzing ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Benchmarking Pricing...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                  Run Competitive Pricing Analysis
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
      {toast && (
        <StatusToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
