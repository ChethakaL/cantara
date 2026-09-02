'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  FileText,
  Save,
  Pencil,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  BarChart3,
  Globe,
  Loader2,
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
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import { buildPricingVerticalReportHtml } from '@/lib/report-export/build-pricing-vertical-report'
import { enrichVerticalSummariesInReport } from '@/lib/pricing-vertical/enrich-vertical-summaries-from-grid'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'

const ACCEPTED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
}

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

export default function PricingByVerticalTab({
  clientId,
  clientName,
  readOnly = false,
}: {
  clientId: string
  clientName: string
  readOnly?: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PricingVerticalReport | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedBadge, setSavedBadge] = useState(false)
  const [reanalyzeNotice, setReanalyzeNotice] = useState<string | null>(null)
  const [websiteUrl, setWebsiteUrl] = useState('')
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

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      setFile(accepted[0])
      setError(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    multiple: false,
  })

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
    } catch (err: any) {
      setError(err.message || 'Re-run failed')
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
      let payloadFile: { fileName: string; base64: string; mediaType: string } | null = null
      if (file) {
        const buffer = await file.arrayBuffer()
        const base64 = btoa(
          new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
        )
        payloadFile = {
          fileName: file.name,
          base64,
          mediaType: file.type || 'application/pdf',
        }
      }

      const res = await fetch('/api/pricing-vertical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          websiteUrl: websiteUrl.trim() || undefined,
          ...payloadFile,
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
      await persistPricingVerticalRun(data)
    } catch (err: any) {
      setError(err.message || 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleReset = async () => {
    setFile(null)
    setResult(null)
    setError(null)
    setEditMode(false)
    try {
      await fetch(`/api/pricing-vertical?clientId=${encodeURIComponent(clientId)}`, { method: 'DELETE' })
    } catch { /* ignore */ }
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
        setTimeout(() => setSavedBadge(false), 2000)
      }
    } catch (err: any) {
      setError(err.message || 'Save failed')
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Pricing by Vertical Analysis</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {clientName} &mdash; {result.verticalSummaries.length} verticals analyzed &mdash; Generated{' '}
              {new Date(result.generatedAt).toLocaleString()}
            </p>
          </div>
          <AdvisorActions className="flex items-center gap-3">
            {!readOnly && (
              <button
                onClick={() => setEditMode(e => !e)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors',
                  editMode
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                <Pencil className="w-3.5 h-3.5" />
                {editMode ? 'Editing' : 'Edit'}
              </button>
            )}
            {!readOnly && editMode && (
              <div className="relative">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-sm transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
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
              className="text-xs"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', analyzing && 'animate-spin')} />
              Re-run analysis
            </Button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              New Analysis
            </button>
          </AdvisorActions>
        </div>

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

        {/* Current Price Source card removed per client request — Source and Confidence not needed */}

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

                  {/* Hidden per product direction (may restore later): yellow "Recommendation" box on each vertical summary card.
                  <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-amber-600 font-bold">Recommendation</p>
                    {editMode ? (
                      <textarea
                        value={vs.recommendation}
                        onChange={e => updateVerticalSummary(i, 'recommendation', e.target.value)}
                        rows={2}
                        className="w-full border border-amber-300 rounded px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y mt-1"
                      />
                    ) : (
                      <p className="text-xs text-slate-700 mt-1">{vs.recommendation}</p>
                    )}
                  </div>
                  */}
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
      </div>
    )
  }

  // ── Analyzing / Processing loading view ───────────────────────────────────
  if (analyzing) {
    return (
      <div className="space-y-6">
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
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-200 border-t-amber-600" />
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold text-slate-800 tracking-tight">Finding Current Prices &amp; Building Grid...</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Scraping current rate cards, analyzing historical price evidence, and constructing the 24-month pricing model for {clientName}.
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-[11px] font-semibold border border-amber-200">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" /> Analysis in progress
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Upload view ─────────────────────────────────────────────────────────────
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
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Pricing by Vertical Analysis</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Scrape current website prices, then build an editable 24-month price grid for {clientName}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Optional upload can add historical rate-card evidence. Internal WS2-3 data may inform the model but is not shown as revenue mix in this report.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Business Website</label>
        <div className="mt-2 flex flex-col gap-3 md:flex-row">
          <input
            value={websiteUrl}
            onChange={e => setWebsiteUrl(e.target.value)}
            placeholder="https://example.com/pricing"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <span className="text-xs text-slate-400 md:self-center">Leave blank to use saved client website.</span>
        </div>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-amber-400 bg-amber-50/50'
            : file
              ? 'border-emerald-300 bg-emerald-50/30'
              : 'border-slate-200 hover:border-slate-300 bg-slate-50/50',
        )}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="w-8 h-8 text-emerald-500" />
            <p className="text-sm font-medium text-slate-700">{file.name}</p>
            <p className="text-xs text-slate-400">Click or drag to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-8 h-8 text-slate-300" />
            <p className="text-sm text-slate-500">
              {isDragActive ? 'Drop file here...' : 'Drag & drop pricing history, or click to browse'}
            </p>
            <p className="text-xs text-slate-400">Optional PDF, PNG, or JPG</p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleAnalyze}
        disabled={analyzing}
        className={cn(
          'flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all w-full md:w-auto',
          !analyzing
            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-sm'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed',
        )}
      >
        {analyzing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            Finding Current Prices...
          </>
        ) : (
          <>
            <BarChart3 className="w-4 h-4" />
            Build Pricing Grid
          </>
        )}
      </button>
    </div>
  )
}
