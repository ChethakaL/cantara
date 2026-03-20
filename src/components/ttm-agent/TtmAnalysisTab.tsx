'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, Play, RefreshCw, ShieldAlert } from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'
import { CraigReviewDashboard } from '@/components/ttm-agent/CraigReviewDashboard'
import { TrendCharts } from '@/components/ttm-agent/TrendCharts'
import { WCSummary } from '@/components/ttm-agent/WCSummary'
import type { DocumentStatus } from '@/lib/store'
import type { TtmAnalysisView, TtmRequiredDocumentId } from '@/lib/ttm-agent/types'

const REQUIRED_DOCS: Array<{ id: TtmRequiredDocumentId; label: string }> = [
  { id: 'monthly_pl_excel', label: 'Monthly P&L Excel' },
  { id: 'monthly_bs_excel', label: 'Monthly Balance Sheet Excel' },
  { id: 'accountant_statements', label: 'Accountant Statements' },
  { id: 'ar_aging_detail', label: 'AR Aging Detail' },
]

function formatCurrency(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `$${value.toLocaleString()}` : 'n/a'
}

function formatPct(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : 'n/a'
}

export function TtmAnalysisTab({
  clientId,
  clientName,
  adminName,
  documentStatuses,
}: {
  clientId: string
  clientName: string
  adminName: string
  documentStatuses: Record<string, DocumentStatus>
}) {
  const [analyses, setAnalyses] = useState<TtmAnalysisView[]>([])
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const readiness = useMemo(
    () =>
      REQUIRED_DOCS.map((doc) => {
        const status = documentStatuses[doc.id]
        return {
          ...doc,
          uploaded: Boolean(status?.fileName),
          fileName: status?.fileName ?? null,
          uploadedAt: status?.uploadedAt ?? null,
        }
      }),
    [documentStatuses],
  )

  const readyToRun = readiness.every((item) => item.uploaded)

  const loadAnalyses = useCallback(async () => {
    const res = await fetch(`/api/ttm-agent/reports?clientId=${clientId}`)
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to load TTM analyses'))
    const data = (await res.json()) as TtmAnalysisView[]
    setAnalyses(data)
    setActiveAnalysisId((current) => current ?? data[0]?.id ?? null)
    return data
  }, [clientId])

  useEffect(() => {
    loadAnalyses().catch((loadError) => {
      console.error(loadError)
      setError(loadError instanceof Error ? loadError.message : 'Failed to load TTM analyses')
    })
  }, [loadAnalyses])

  useEffect(() => {
    if (!running) return
    const interval = setInterval(() => {
      loadAnalyses().catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [loadAnalyses, running])

  const activeAnalysis = analyses.find((analysis) => analysis.id === activeAnalysisId) ?? analyses[0] ?? null

  const runAgent = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/ttm-agent/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          triggeredByName: adminName,
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Failed to run TTM agent')
      }

      const created = (await res.json()) as TtmAnalysisView
      setAnalyses((current) => [created, ...current.filter((analysis) => analysis.id !== created.id)])
      setActiveAnalysisId(created.id)
    } catch (runError) {
      console.error(runError)
      setError(runError instanceof Error ? runError.message : 'Failed to run TTM agent')
    } finally {
      setRunning(false)
    }
  }

  const handleUpdatedAnalysis = (updated: TtmAnalysisView) => {
    setAnalyses((current) => current.map((analysis) => (analysis.id === updated.id ? updated : analysis)))
    setActiveAnalysisId(updated.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 cantara-serif">TTM Analysis</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Financial review dashboard for reconciliation, trend analysis, working capital, and HITL clearance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadAnalyses()}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => void runAgent()} disabled={!readyToRun || running}>
            <Play className="w-3.5 h-3.5" />
            {running ? 'Running TTM Agent...' : 'Run TTM Agent'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-amber-600" />
            <h4 className="text-sm font-semibold text-slate-800">Source Readiness</h4>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {readiness.map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-700">{item.label}</p>
                  <Badge color={item.uploaded ? 'green' : 'red'}>{item.uploaded ? 'Uploaded' : 'Missing'}</Badge>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  {item.fileName || 'No file uploaded yet.'}
                </p>
                {item.uploadedAt && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    {new Date(item.uploadedAt).toLocaleString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-500" />
            <h4 className="text-sm font-semibold text-slate-800">Optional Sources</h4>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">QuickBooks API</p>
              <Badge color="slate">Not Connected</Badge>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Section B remains in the report and is marked skipped until QuickBooks integration is added.
            </p>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Run Status</p>
            <p className="mt-2 text-sm text-slate-700">
              {readyToRun ? 'All required valuation documents are present.' : 'Upload all four required valuation documents before running the TTM agent.'}
            </p>
          </div>
        </Card>
      </div>

      {analyses.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {analyses.map((analysis) => (
            <button
              key={analysis.id}
              onClick={() => setActiveAnalysisId(analysis.id)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                activeAnalysis?.id === analysis.id ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              Run #{analysis.version}
              <span className="ml-2 text-slate-400">{new Date(analysis.createdAt).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      )}

      {activeAnalysis ? (
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Analysis Snapshot</h4>
                <p className="text-xs text-slate-400 mt-1">
                  {clientName} · Run #{activeAnalysis.version} · {new Date(activeAnalysis.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge color={activeAnalysis.status === 'APPROVED' ? 'green' : activeAnalysis.status === 'FAILED' ? 'red' : 'gold'}>
                  {activeAnalysis.status}
                </Badge>
                <Badge color="blue">{activeAnalysis.hitlStatus}</Badge>
              </div>
            </div>
            {activeAnalysis.summary && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-700">{activeAnalysis.summary.overview}</p>
                {activeAnalysis.summary.qualitySummary && (
                  <p className="text-xs text-slate-500 mt-2">{activeAnalysis.summary.qualitySummary}</p>
                )}
              </div>
            )}

            {activeAnalysis.ttmSummary && (
              <div className="grid gap-3 md:grid-cols-4 mt-4">
                {[
                  { label: 'TTM Revenue', value: formatCurrency(activeAnalysis.ttmSummary.totalRevenue) },
                  { label: 'Gross Margin', value: formatPct(activeAnalysis.ttmSummary.grossMarginPct) },
                  { label: 'TTM EBITDA (pre-recast)', value: formatCurrency(activeAnalysis.ttmSummary.ebitdaPreRecast) },
                  { label: '36-Month Confidence', value: activeAnalysis.structuredModel?.confidence ?? 'n/a' },
                ].map((metric) => (
                  <div key={metric.label} className="rounded-xl border border-slate-200 p-4">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">{metric.label}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-800">{metric.value}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <TrendCharts annualModel={activeAnalysis.annualModel} />
          <WCSummary summary={activeAnalysis.workingCapital} />
          <CraigReviewDashboard analysis={activeAnalysis} actorName={adminName} onUpdated={handleUpdatedAnalysis} />
        </div>
      ) : (
        <Card className="p-8 text-center text-sm text-slate-400">
          No TTM runs yet. Upload the four required valuation documents in the client Collection flow, then run the agent here.
        </Card>
      )}
    </div>
  )
}
