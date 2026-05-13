'use client'

import { useState, useCallback, useEffect } from 'react'
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
} from 'lucide-react'
import { Card, Badge, cn } from '@/components/ui'
import type {
  PricingVerticalReport,
  PriceChangeEvent,
  VerticalPricingSummary,
} from '@/lib/pricing-vertical/types'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { buildPricingVerticalReportHtml } from '@/lib/report-export/build-pricing-vertical-report'

const ACCEPTED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
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
}: {
  clientId: string
  clientName: string
}) {
  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PricingVerticalReport | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedBadge, setSavedBadge] = useState(false)

  // Load saved data on mount
  useEffect(() => {
    const loadSaved = async () => {
      try {
        const res = await fetch(`/api/pricing-vertical?clientId=${encodeURIComponent(clientId)}`)
        if (res.ok) {
          const data = await res.json()
          if (data && data.executiveSummary) {
            setResult(data)
          }
        }
      } catch { /* ignore */ }
    }
    loadSaved()
  }, [clientId])

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

  const handleAnalyze = async () => {
    if (!file) return
    setAnalyzing(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
      )

      const res = await fetch('/api/pricing-vertical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          fileName: file.name,
          base64,
          mediaType: file.type || 'application/pdf',
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Analysis failed (${res.status})`)
      }
      const data: PricingVerticalReport = await res.json()
      setResult(data)
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
    setSaving(true)
    try {
      const res = await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'pricingVertical', data: result }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSavedBadge(true)
      setTimeout(() => setSavedBadge(false), 2000)
    } catch (err: any) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
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

  const updateRecommendation = (index: number, value: string) => {
    if (!result) return
    const recs = [...result.recommendations]
    recs[index] = value
    setResult({ ...result, recommendations: recs })
  }

  const addRecommendation = () => {
    if (!result) return
    setResult({ ...result, recommendations: [...result.recommendations, ''] })
  }

  const removeRecommendation = (index: number) => {
    if (!result) return
    const recs = [...result.recommendations]
    recs.splice(index, 1)
    setResult({ ...result, recommendations: recs })
  }

  // ── Results view ────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Pricing by Vertical Analysis</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {clientName} &mdash; {result.verticalSummaries.length} verticals analyzed &mdash; Generated{' '}
              {new Date(result.generatedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
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
            {editMode && (
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
              html={buildPricingVerticalReportHtml(result, clientName)}
              fileName={`pricing-vertical-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
              label="Export PDF"
            />
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              New Analysis
            </button>
          </div>
        </div>

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
            Vertical Summaries ({result.verticalSummaries.length})
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {result.verticalSummaries.map((vs, i) => {
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
                        {vs.avgChangePercent !== null ? `${vs.avgChangePercent.toFixed(1)}%` : 'N/A'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">Revenue Share</p>
                      {editMode ? (
                        <input
                          value={vs.revenueShare}
                          onChange={e => updateVerticalSummary(i, 'revenueShare', e.target.value)}
                          className="w-full border border-amber-300 rounded px-1 py-0.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 mt-0.5"
                        />
                      ) : (
                        <p className="text-sm font-bold text-slate-800 mt-0.5">{vs.revenueShare}</p>
                      )}
                    </div>
                  </div>

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
                </Card>
              )
            })}
          </div>
        </div>

        {/* Flags */}
        <Card className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Pricing Flags</h3>
          <div className="space-y-2">
            {result.flags.map((flag, i) => (
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
                  <span className="text-xs font-semibold text-slate-800">{flag.title}</span>
                </div>
                <p className="text-xs text-slate-600">{flag.description}</p>
              </div>
            ))}
            {result.flags.length === 0 && (
              <p className="text-sm text-slate-400">No flags identified.</p>
            )}
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
            {result.recommendations.map((rec, i) => (
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
      </div>
    )
  }

  // ── Upload view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Pricing by Vertical Analysis</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Upload pricing history (rate cards, price change logs) to analyze price changes over the past 24 months by service vertical for {clientName}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Revenue by vertical data is automatically loaded from the WS2-3 derived report.
        </p>
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
            <p className="text-xs text-slate-400">PDF, PNG, JPG, XLSX, or XLS</p>
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
        disabled={!file || analyzing}
        className={cn(
          'flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all w-full md:w-auto',
          file && !analyzing
            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-sm'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed',
        )}
      >
        {analyzing ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Analyzing Pricing History...
          </>
        ) : (
          <>
            <BarChart3 className="w-4 h-4" />
            Analyze Pricing by Vertical
          </>
        )}
      </button>
    </div>
  )
}
