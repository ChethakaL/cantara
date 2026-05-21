'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  AlertTriangle,
  RefreshCw,
  Save,
  Pencil,
  TrendingUp,
  DollarSign,
  BarChart3,
} from 'lucide-react'
import { Card, Badge, cn } from '@/components/ui'
import type { CompetitorPricingInput, PricingAnalysisReport, PriceMatrixRow, PricingSummaryRow, PricingFlag } from '@/lib/pricing-analysis/types'
import {
  getCompetitorNamesFromReport,
  hasPricingTableData,
  normalizePricingReport,
} from '@/lib/pricing-analysis/normalize-report'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { buildPricingAnalysisReportHtml } from '@/lib/report-export/build-pricing-analysis-report'

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

  // Load saved data on mount
  useEffect(() => {
    const loadSaved = async () => {
      try {
        const res = await fetch(`/api/pricing-analysis?clientId=${encodeURIComponent(clientId)}&includePrefill=1`)
        if (res.ok) {
          const data = await res.json()
          const normalized = normalizePricingReport(data?.report)
          if (normalized) {
            setResult(normalized)
          }
          if (data?.prefill) {
            setSellerWebsiteUrl(data.prefill.sellerWebsiteUrl ?? '')
            setSellerManualPricingText(data.prefill.sellerManualPricingText ?? '')
            const prefillCompetitors = [...(data.prefill.competitors ?? [])].slice(0, 5)
            setCompetitors(Array.from({ length: 5 }, (_, index) => prefillCompetitors[index] ?? { name: '', websiteUrl: '' }))
          }
        }
      } catch { /* ignore */ }
    }
    loadSaved()
  }, [clientId])

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
        }),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Analysis failed (${res.status})`)
      }
      const data = normalizePricingReport(await res.json())
      if (!data) throw new Error('Analysis returned an invalid report. Please run again.')
      setResult(data)
      setEditMode(false)
      setRerunComplete(true)
      setTimeout(() => setRerunComplete(false), 3500)
    } catch (err: any) {
      setError(err.message || 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleReset = async () => {
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
  const updateMatrixRow = (index: number, field: keyof PriceMatrixRow, value: any) => {
    if (!result) return
    const matrix = [...(result.priceMatrix ?? [])]
    matrix[index] = { ...matrix[index], [field]: value }
    setResult({ ...result, priceMatrix: matrix })
  }

  const updateMatrixCompetitor = (rowIndex: number, compIndex: number, field: string, value: string) => {
    if (!result) return
    const matrix = [...(result.priceMatrix ?? [])]
    const comps = [...matrix[rowIndex].competitors]
    comps[compIndex] = { ...comps[compIndex], [field]: value }
    matrix[rowIndex] = { ...matrix[rowIndex], competitors: comps }
    setResult({ ...result, priceMatrix: matrix })
  }

  const updateSummaryRow = (index: number, field: keyof PricingSummaryRow, value: any) => {
    if (!result) return
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
      setTimeout(() => setInputsSaved(false), 2000)
    } catch (err: any) {
      setError(err.message || 'Save failed')
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
            {rerunComplete && (
              <span className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                Analysis updated
              </span>
            )}
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
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors disabled:opacity-70"
              >
                <RefreshCw className={cn('w-3.5 h-3.5', analyzing && 'animate-spin')} />
                {analyzing ? 'Updating analysis...' : 'Run AI Again'}
              </button>
            )}
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
              fileName={`competitor-pricing-analysis-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
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

        {/* Table 1: Detailed Competitor Price Matrix */}
        {(result.priceMatrix ?? []).length > 0 && (
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Detailed Competitor Price Matrix
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Service</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Basis</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-600 bg-yellow-50">Your Price</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-600 bg-yellow-50">Norm. Daily</th>
                    {competitorNames.map(name => (
                      <th key={`${name}-listed`} colSpan={2} className="text-center px-3 py-2.5 font-semibold text-slate-600 bg-emerald-50 border-l border-slate-100">
                        {name}
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-200 bg-slate-50/30">
                    <th className="px-3 py-1" />
                    <th className="px-3 py-1" />
                    <th className="px-3 py-1 bg-yellow-50" />
                    <th className="px-3 py-1 bg-yellow-50" />
                    {competitorNames.map(name => (
                      <>
                        <th key={`${name}-sub-listed`} className="text-right px-3 py-1 text-[10px] font-medium text-slate-400 bg-emerald-50 border-l border-slate-100">Listed</th>
                        <th key={`${name}-sub-norm`} className="text-right px-3 py-1 text-[10px] font-medium text-slate-400 bg-emerald-50">Norm.</th>
                      </>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(result.priceMatrix ?? []).map((row, ri) => {
                    const compMap = new Map(row.competitors.map(c => [c.name, c]))
                    return (
                      <tr key={ri} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-slate-800">
                          <EditableCell value={row.service} onChange={v => updateMatrixRow(ri, 'service', v)} editMode={editMode} />
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          <EditableCell value={row.basis} onChange={v => updateMatrixRow(ri, 'basis', v)} editMode={editMode} />
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold bg-yellow-50 text-slate-900">
                          <EditableCell value={row.sellerPrice} onChange={v => updateMatrixRow(ri, 'sellerPrice', v)} editMode={editMode} />
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold bg-yellow-50 text-slate-900">
                          <EditableCell value={row.sellerNormalized} onChange={v => updateMatrixRow(ri, 'sellerNormalized', v)} editMode={editMode} />
                        </td>
                        {competitorNames.map((name, ci) => {
                          const comp = compMap.get(name)
                          const compIdx = row.competitors.findIndex(c => c.name === name)
                          return (
                            <>
                              <td key={`${name}-listed-${ri}`} className="px-3 py-2.5 text-right bg-emerald-50/50 text-slate-700 border-l border-slate-100">
                                {editMode && compIdx >= 0 ? (
                                  <EditableCell value={comp?.listedPrice ?? '--'} onChange={v => updateMatrixCompetitor(ri, compIdx, 'listedPrice', v)} editMode={editMode} />
                                ) : (
                                  comp?.listedPrice ?? '--'
                                )}
                              </td>
                              <td key={`${name}-norm-${ri}`} className="px-3 py-2.5 text-right bg-emerald-50/50 text-slate-700" title={comp?.normalizationNote ?? ''}>
                                {editMode && compIdx >= 0 ? (
                                  <EditableCell value={comp?.normalized ?? '--'} onChange={v => updateMatrixCompetitor(ri, compIdx, 'normalized', v)} editMode={editMode} />
                                ) : (
                                  <span>
                                    {comp?.normalized ?? '--'}
                                    {comp?.normalizationNote && (
                                      <span className="block text-[9px] text-slate-400 mt-0.5">{comp.normalizationNote}</span>
                                    )}
                                  </span>
                                )}
                              </td>
                            </>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Table 2: Pricing Summary & Variance */}
        {(result.pricingSummary ?? []).length > 0 && (
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Pricing Summary & Variance
              </h3>
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
                    <th className="text-right px-4 py-2.5 font-semibold text-slate-600">Est. Annual Uplift</th>
                  </tr>
                </thead>
                <tbody>
                  {(result.pricingSummary ?? []).map((row, i) => {
                    const statusConfig = STATUS_COLORS[row.status] || STATUS_COLORS.unknown
                    return (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          <EditableCell value={row.service} onChange={v => updateSummaryRow(i, 'service', v)} editMode={editMode} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <EditableCell value={row.sellerPrice} onChange={v => updateSummaryRow(i, 'sellerPrice', v)} editMode={editMode} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <EditableCell value={row.competitorAvg} onChange={v => updateSummaryRow(i, 'competitorAvg', v)} editMode={editMode} />
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold">
                          <EditableCell
                            value={row.variance}
                            onChange={v => updateSummaryRow(i, 'variance', v)}
                            editMode={editMode}
                            className={
                              row.variancePercent !== null && row.variancePercent < -10
                                ? 'text-red-600'
                                : row.variancePercent !== null && row.variancePercent > 15
                                  ? 'text-blue-600'
                                  : 'text-emerald-600'
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
                        <td className="px-4 py-2.5 text-right">
                          <EditableCell value={row.estAnnualUplift} onChange={v => updateSummaryRow(i, 'estAnnualUplift', v)} editMode={editMode} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Total Estimated Uplift */}
        <Card className="p-5 border-emerald-200 bg-emerald-50/30">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            {editMode ? (
              <input
                type="text"
                value={result.totalEstimatedUplift}
                onChange={e => setResult({ ...result, totalEstimatedUplift: e.target.value })}
                className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-lg font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            ) : (
              <>
                <span className="text-lg font-bold text-emerald-700">{result.totalEstimatedUplift}</span>
                <span className="text-xs text-emerald-600">Total Estimated Annual Uplift</span>
              </>
            )}
          </div>
        </Card>

        {/* Flags */}
        <Card className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Pricing Flags</h3>
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
      </div>
    )
  }

  // ── Upload view ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Competitive Pricing Analysis</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Compare {clientName} pricing against exactly 5 named competitors using seller and competitor websites.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Competitors are prefilled from Competitor Analysis or client collection inputs when available.
        </p>
      </div>

      <Card className="p-5">
        <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Seller Website</label>
        <input
          value={sellerWebsiteUrl}
          onChange={e => setSellerWebsiteUrl(e.target.value)}
          placeholder="https://seller-website.com/pricing"
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </Card>

      <Card className="p-5">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Competitors (all 5 required)</h3>
        <div className="space-y-3">
          {competitors.map((competitor, index) => (
            <div key={index} className="grid gap-3 md:grid-cols-[1fr_1.4fr]">
              <input
                value={competitor.name}
                onChange={e => updateCompetitor(index, 'name', e.target.value)}
                placeholder={`Competitor ${index + 1} name`}
                required
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <input
                value={competitor.websiteUrl}
                onChange={e => updateCompetitor(index, 'websiteUrl', e.target.value)}
                placeholder="https://competitor.com/pricing"
                required
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          ))}
        </div>
      </Card>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleAnalyze}
        disabled={analyzing || !sellerWebsiteUrl.trim() || competitors.filter(c => c.name.trim() && c.websiteUrl.trim()).length !== 5}
        className={cn(
          'flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all w-full md:w-auto',
          !analyzing && sellerWebsiteUrl.trim() && competitors.filter(c => c.name.trim() && c.websiteUrl.trim()).length === 5
            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-sm'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed',
        )}
      >
        {analyzing ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Researching Competitive Pricing...
          </>
        ) : (
          <>
            <BarChart3 className="w-4 h-4" />
            Run Competitive Pricing Analysis
          </>
        )}
      </button>
      <button
        onClick={saveCompetitorInputs}
        disabled={savingInputs}
        className="ml-3 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all"
      >
        <Save className="w-4 h-4" />
        {savingInputs ? 'Saving...' : inputsSaved ? 'Saved' : 'Save Inputs'}
      </button>
    </div>
  )
}
