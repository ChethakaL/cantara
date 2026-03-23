'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileSpreadsheet, Play, RefreshCw, ShieldAlert } from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'
import { CraigReviewDashboard } from '@/components/ttm-agent/CraigReviewDashboard'
import { TrendCharts } from '@/components/ttm-agent/TrendCharts'
import { WCSummary } from '@/components/ttm-agent/WCSummary'
import { Ws2RecastPanel } from '@/components/ttm-agent/Ws2RecastPanel'
import { Ws2DerivedReportsPanel } from '@/components/ttm-agent/Ws2DerivedReportsPanel'
import { logWs2ClientEvent, logWs2Error, logWs2PreparedDocuments, logWs2Response } from '@/lib/ttm-agent/browser-debug'
import { prepareWs2DocumentFromServer } from '@/lib/ttm-agent/browser-documents'
import type { DocumentStatus } from '@/lib/store'
import type { TtmAnalysisView, TtmRequiredDocumentId } from '@/lib/ttm-agent/types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
  const [collapseWs21, setCollapseWs21] = useState(false)

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
    await logWs2Response('WS2-1 load analyses', res)
    if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to load TTM analyses'))
    const data = (await res.json()) as TtmAnalysisView[]
    setAnalyses(data)
    setActiveAnalysisId((current) => current ?? data[0]?.id ?? null)
    return data
  }, [clientId])

  useEffect(() => {
    loadAnalyses().catch((loadError) => {
      logWs2Error('WS2-1 load analyses', loadError, { clientId })
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

  useEffect(() => {
    setCollapseWs21(Boolean(activeAnalysis?.recastAnalyses?.length))
  }, [activeAnalysisId, activeAnalysis?.recastAnalyses?.length])

  const runAgent = async () => {
    setRunning(true)
    setError(null)
    try {
      const preparedDocuments = await Promise.all(
        readiness.map((item) =>
          prepareWs2DocumentFromServer({
            clientId,
            documentId: item.id,
            fileName: item.fileName || item.label,
          }),
        ),
      )
      logWs2PreparedDocuments('WS2-1 prepared documents', preparedDocuments)
      logWs2ClientEvent('WS2-1 run request', {
        clientId,
        triggeredByName: adminName,
        documentIds: preparedDocuments.map((doc) => doc.documentId),
      })

      const res = await fetch('/api/ttm-agent/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          triggeredByName: adminName,
          preparedDocuments,
        }),
      })
      await logWs2Response('WS2-1 run response', res)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Failed to run WS2-1 agent')
      }

      const created = (await res.json()) as TtmAnalysisView
      logWs2ClientEvent('WS2-1 created analysis', {
        id: created.id,
        version: created.version,
        status: created.status,
        hitlStatus: created.hitlStatus,
      })
      setAnalyses((current) => [created, ...current.filter((analysis) => analysis.id !== created.id)])
      setActiveAnalysisId(created.id)
    } catch (runError) {
      logWs2Error('WS2-1 run', runError, { clientId, adminName })
      setError(runError instanceof Error ? runError.message : 'Failed to run WS2-1 agent')
    } finally {
      setRunning(false)
    }
  }

  const handleUpdatedAnalysis = (updated: TtmAnalysisView) => {
    logWs2ClientEvent('WS2 analysis updated in UI', {
      id: updated.id,
      version: updated.version,
      status: updated.status,
      hitlStatus: updated.hitlStatus,
      recastRuns: updated.recastAnalyses?.length ?? 0,
      derivedReports: updated.derivedReports?.length ?? 0,
    })
    setAnalyses((current) => current.map((analysis) => (analysis.id === updated.id ? updated : analysis)))
    setActiveAnalysisId(updated.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 cantara-serif">WS2 Financial Analysis</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            WS2-1 dashboard for client-side CSV ingestion, exact-architecture reporting, reconciliation, working capital, and Craig HITL clearance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadAnalyses()}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => void runAgent()} disabled={!readyToRun || running}>
            <Play className="w-3.5 h-3.5" />
            {running ? 'Running WS2-1 Agent...' : 'Run WS2-1 Agent'}
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
              {readyToRun ? 'All required WS2-1 source documents are present.' : 'Upload all four WS2-1 source documents before running the agent.'}
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
                <h4 className="text-sm font-semibold text-slate-800">WS2-1 Review Pack</h4>
                <p className="text-xs text-slate-400 mt-1">
                  {clientName} · Run #{activeAnalysis.version} · {new Date(activeAnalysis.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge color={activeAnalysis.status === 'APPROVED' ? 'green' : activeAnalysis.status === 'FAILED' ? 'red' : 'gold'}>
                  {activeAnalysis.status}
                </Badge>
                <Badge color="blue">{activeAnalysis.hitlStatus}</Badge>
                <Button size="sm" variant="outline" onClick={() => setCollapseWs21((current) => !current)}>
                  {collapseWs21 ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {collapseWs21 ? 'Expand WS2-1' : 'Collapse WS2-1'}
                </Button>
              </div>
            </div>

            {collapseWs21 ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                {activeAnalysis.summary && <p className="text-sm text-slate-700">{activeAnalysis.summary.overview}</p>}
                {activeAnalysis.ttmSummary && (
                  <div className="grid gap-3 md:grid-cols-4 mt-4">
                    {[
                      { label: 'TTM Revenue', value: formatCurrency(activeAnalysis.ttmSummary.totalRevenue) },
                      { label: 'Gross Margin', value: formatPct(activeAnalysis.ttmSummary.grossMarginPct) },
                      { label: 'TTM EBITDA (pre-recast)', value: formatCurrency(activeAnalysis.ttmSummary.ebitdaPreRecast) },
                      { label: 'Open HITL Items', value: String(activeAnalysis.flags.filter((flag) => flag.resolutionStatus !== 'ACTIONED').length) },
                    ].map((metric) => (
                      <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400">{metric.label}</p>
                        <p className="mt-2 text-lg font-semibold text-slate-800">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
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
              </>
            )}
          </Card>

          {!collapseWs21 && activeAnalysis.reportMarkdown && (
            <Card className="p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">WS2-1 Report</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Produced by WS2-1 TTM Financial Analysis Agent.
                  </p>
                </div>
              </div>
              <div className="prose prose-slate max-w-none mt-4 text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeAnalysis.reportMarkdown}</ReactMarkdown>
              </div>
            </Card>
          )}

          {!collapseWs21 && <TrendCharts annualModel={activeAnalysis.annualModel} />}
          {!collapseWs21 && <WCSummary summary={activeAnalysis.workingCapital} />}
          {!collapseWs21 && <CraigReviewDashboard analysis={activeAnalysis} actorName={adminName} onUpdated={handleUpdatedAnalysis} />}
          <Ws2RecastPanel
            analysis={activeAnalysis}
            clientId={clientId}
            adminName={adminName}
            documentStatuses={documentStatuses}
            onUpdated={handleUpdatedAnalysis}
          />
          <Ws2DerivedReportsPanel
            analysis={activeAnalysis}
            clientId={clientId}
            documentStatuses={documentStatuses}
            onUpdated={handleUpdatedAnalysis}
          />
        </div>
      ) : (
        <Card className="p-8 text-center text-sm text-slate-400">
          No WS2-1 runs yet. Upload the four required valuation documents in the client Collection flow, then run the agent here.
        </Card>
      )}
    </div>
  )
}
