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
  DollarSign,
  BarChart3,
} from 'lucide-react'
import { Card, Badge, cn } from '@/components/ui'
import type { PricingAnalysisReport, ServicePricingComparison, PricingFlag } from '@/lib/pricing-analysis/types'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { buildPricingAnalysisReportHtml } from '@/lib/report-export/build-pricing-analysis-report'

const ACCEPTED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
}

const STATUS_COLORS: Record<string, { badge: 'red' | 'green' | 'blue' | 'slate'; label: string; className: string }> = {
  underpriced: { badge: 'red', label: 'Underpriced', className: 'bg-red-50 text-red-700 border-red-200' },
  'at-market': { badge: 'green', label: 'At Market', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  premium: { badge: 'blue', label: 'Premium', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  unknown: { badge: 'slate', label: 'Unknown', className: 'bg-slate-50 text-slate-700 border-slate-200' },
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

export default function PricingAnalysisTab({
  clientId,
  clientName,
}: {
  clientId: string
  clientName: string
}) {
  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<PricingAnalysisReport | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedBadge, setSavedBadge] = useState(false)

  // Load saved data on mount
  useEffect(() => {
    const loadSaved = async () => {
      try {
        const res = await fetch(`/api/pricing-analysis?clientId=${encodeURIComponent(clientId)}`)
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

      const res = await fetch('/api/pricing-analysis', {
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
      const data: PricingAnalysisReport = await res.json()
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
      await fetch(`/api/pricing-analysis?clientId=${encodeURIComponent(clientId)}`, { method: 'DELETE' })
    } catch { /* ignore */ }
  }

  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    try {
      const res = await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'pricingAnalysis', data: result }),
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
  const updateComparison = (index: number, field: keyof ServicePricingComparison, value: any) => {
    if (!result) return
    const comparisons = [...result.serviceComparisons]
    comparisons[index] = { ...comparisons[index], [field]: value }
    setResult({ ...result, serviceComparisons: comparisons })
  }

  const updateFlag = (index: number, field: keyof PricingFlag, value: string) => {
    if (!result) return
    const flags = [...result.flags]
    flags[index] = { ...flags[index], [field]: value }
    setResult({ ...result, flags })
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
            <h2 className="text-lg font-semibold text-slate-800">Competitive Pricing Analysis</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {clientName} &mdash; {result.competitorsAnalyzed} competitors analyzed &mdash; Generated{' '}
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
              html={buildPricingAnalysisReportHtml(result, clientName)}
              fileName={`pricing-analysis-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
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

        {/* Revenue Uplift Summary */}
        <Card className="p-5 border-emerald-200 bg-emerald-50/30">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-700">Revenue Uplift Summary</h3>
          </div>
          {editMode ? (
            <div className="space-y-3">
              <textarea
                value={result.revenueUpliftSummary}
                onChange={e => setResult({ ...result, revenueUpliftSummary: e.target.value })}
                rows={3}
                className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
              />
              <div>
                <label className="text-xs text-slate-500">Total Estimated Uplift</label>
                <input
                  type="text"
                  value={result.totalEstimatedUplift}
                  onChange={e => setResult({ ...result, totalEstimatedUplift: e.target.value })}
                  className="w-full border border-amber-300 rounded-lg px-3 py-2 text-lg font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-700 leading-relaxed mb-3">{result.revenueUpliftSummary}</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 border border-emerald-200 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span className="text-lg font-bold text-emerald-700">{result.totalEstimatedUplift}</span>
                <span className="text-xs text-emerald-600">Total Estimated Annual Uplift</span>
              </div>
            </>
          )}
        </Card>

        {/* Service Pricing Comparison Table */}
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Service Pricing Comparison ({result.serviceComparisons.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Service</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Seller Price</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Market Avg</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Range</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Variance</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-slate-500">Status</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Uplift Opportunity</th>
                </tr>
              </thead>
              <tbody>
                {result.serviceComparisons.map((svc, i) => {
                  const statusConfig = STATUS_COLORS[svc.status] || STATUS_COLORS.unknown
                  return (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5 font-medium">
                        <EditableCell
                          value={svc.serviceCategory}
                          onChange={v => updateComparison(i, 'serviceCategory', v)}
                          editMode={editMode}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <EditableCell
                          value={svc.sellerPrice}
                          onChange={v => updateComparison(i, 'sellerPrice', v)}
                          editMode={editMode}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <EditableCell
                          value={svc.competitorAvgPrice}
                          onChange={v => updateComparison(i, 'competitorAvgPrice', v)}
                          editMode={editMode}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <EditableCell
                          value={svc.competitorRange}
                          onChange={v => updateComparison(i, 'competitorRange', v)}
                          editMode={editMode}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <EditableCell
                          value={svc.variance}
                          onChange={v => updateComparison(i, 'variance', v)}
                          editMode={editMode}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {editMode ? (
                          <select
                            value={svc.status}
                            onChange={e => updateComparison(i, 'status', e.target.value)}
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
                      <td className="px-4 py-2.5">
                        <EditableCell
                          value={svc.upliftOpportunity}
                          onChange={v => updateComparison(i, 'upliftOpportunity', v)}
                          editMode={editMode}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>

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
                  {editMode ? (
                    <input
                      value={flag.title}
                      onChange={e => updateFlag(i, 'title', e.target.value)}
                      className="flex-1 border border-amber-300 rounded px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-slate-800">{flag.title}</span>
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
        <h2 className="text-lg font-semibold text-slate-800">Competitive Pricing Analysis</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Upload the seller&apos;s current pricing schedule to compare against local competitor pricing data for {clientName}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Competitor pricing data is automatically loaded from the Competitor Analysis agent.
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
              {isDragActive ? 'Drop file here...' : 'Drag & drop a pricing schedule, or click to browse'}
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
            Analyzing Pricing...
          </>
        ) : (
          <>
            <BarChart3 className="w-4 h-4" />
            Analyze Pricing
          </>
        )}
      </button>
    </div>
  )
}
