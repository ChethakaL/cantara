'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, Loader2, Play, RefreshCw, ShieldAlert, Download } from 'lucide-react'
import { buildWS2ReportAdapter } from '@/lib/ttm-agent/export-adapter'
import { exportWS2Workbook } from '@/lib/ws2/ws2-export'
import { Badge, Button, Card } from '@/components/ui'
import { Ws2RecastPanel } from '@/components/ttm-agent/Ws2RecastPanel'
import { BaselineValuationReportPanel } from '@/components/ttm-agent/BaselineValuationReportPanel'
import { Ws21ReviewWorkspace } from '@/components/ttm-agent/Ws21ReviewWorkspace'
import { logWs2ClientEvent, logWs2Error, logWs2PreparedDocuments, logWs2Response } from '@/lib/ttm-agent/browser-debug'
import { prepareWs2DocumentFromServer } from '@/lib/ttm-agent/browser-documents'
import type { DocumentStatus } from '@/lib/store'
import type { TtmAnalysisView, TtmRequiredDocumentId } from '@/lib/ttm-agent/types'

const REQUIRED_DOCS: Array<{ id: TtmRequiredDocumentId; label: string }> = [
  { id: 'monthly_pl_excel', label: 'Monthly P&L (36 months)' },
  { id: 'monthly_bs_excel', label: 'Monthly Balance Sheet (36 months)' },
]

type Ws2SectionKey =
  | 'ws21-pack'
  | 'ws21-report'
  | 'ws21-trends'
  | 'ws21-working-capital'
  | 'ws21-review'
  | 'ws22-recast'
  | 'ws23-report'
  | 'ws24-report'
  | 'ws25-report'
  | 'ws210-report'

const DEFAULT_SECTION_STATE: Record<Ws2SectionKey, boolean> = {
  'ws21-pack': false,
  'ws21-report': false,
  'ws21-trends': false,
  'ws21-working-capital': false,
  'ws21-review': false,
  'ws22-recast': false,
  'ws23-report': false,
  'ws24-report': false,
  'ws25-report': false,
  'ws210-report': false,
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
  const [loadingAnalyses, setLoadingAnalyses] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Record<Ws2SectionKey, boolean>>(DEFAULT_SECTION_STATE)
  const [baselineBuildState, setBaselineBuildState] = useState<{
    analysisId: string | null
    running: boolean
    step: string | null
    error: string | null
  }>({
    analysisId: null,
    running: false,
    step: null,
    error: null,
  })

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
    setLoadingAnalyses(true)
    try {
      const res = await fetch(`/api/ttm-agent/reports?clientId=${clientId}`)
      await logWs2Response('WS2-1 load analyses', res)
      if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to load TTM analyses'))
      const data = (await res.json()) as TtmAnalysisView[]
      setAnalyses(data)
      setActiveAnalysisId((current) => current ?? data[0]?.id ?? null)
      return data
    } finally {
      setLoadingAnalyses(false)
    }
  }, [clientId])

  useEffect(() => {
    loadAnalyses().catch((loadError) => {
      logWs2Error('WS2-1 load analyses', loadError, { clientId })
      setError(loadError instanceof Error ? loadError.message : 'Failed to load TTM analyses')
    })
  }, [loadAnalyses])

  useEffect(() => {
    if (!running && !baselineBuildState.running) return
    const interval = setInterval(() => {
      loadAnalyses().catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [baselineBuildState.running, loadAnalyses, running])

  const activeAnalysis = analyses.find((analysis) => analysis.id === activeAnalysisId) ?? analyses[0] ?? null

  useEffect(() => {
    setCollapsedSections((current) => {
      const next = { ...DEFAULT_SECTION_STATE, ...current }
      const latestBaselineReport = activeAnalysis?.derivedReports?.find((item) => item.agentId === 'ws2_10_report_generator_v1')
      if (activeAnalysis?.status === 'APPROVED') {
        next['ws21-pack'] = true
        next['ws21-report'] = true
        next['ws21-trends'] = true
        next['ws21-working-capital'] = true
        next['ws21-review'] = true
      }
      const latestRecast = activeAnalysis?.recastAnalyses?.[0]
      if (latestRecast?.status === 'APPROVED') {
        next['ws22-recast'] = true
      }
      if (latestBaselineReport?.status === 'COMPLETE') {
        next['ws210-report'] = false
        next['ws23-report'] = true
        next['ws24-report'] = true
        next['ws25-report'] = true
      }
      return next
    })
  }, [activeAnalysisId, activeAnalysis?.status, activeAnalysis?.recastAnalyses, activeAnalysis?.derivedReports])

  const toggleSection = (section: Ws2SectionKey) => {
    setCollapsedSections((current) => ({
      ...current,
      [section]: !current[section],
    }))
  }

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

  const handleUpdatedAnalysis = useCallback((updated: TtmAnalysisView) => {
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
  }, [])

  const exportToExcel = () => {
    if (!activeAnalysis) return
    const latestRecast1 = activeAnalysis.recastAnalyses?.[0] ?? null
    // Build the adapter
    const ws2Report = buildWS2ReportAdapter(clientName, activeAnalysis, latestRecast1, activeAnalysis.derivedReports || [])
    exportWS2Workbook(ws2Report)
  }

  const latestRecast = activeAnalysis?.recastAnalyses?.[0] ?? null
  const derivedByAgent = new Map((activeAnalysis?.derivedReports ?? []).map((report) => [report.agentId, report]))
  const baselineReport = derivedByAgent.get('ws2_10_report_generator_v1') ?? null
  const hasStyledBaselineReport = Boolean(baselineReport && latestRecast?.status === 'APPROVED')
  const ws21Approved = activeAnalysis?.status === 'APPROVED'
  const shouldAutoBuildBaseline = Boolean(
    activeAnalysis &&
      ws21Approved &&
      latestRecast?.status === 'APPROVED' &&
      !hasStyledBaselineReport,
  )
  const showWs21Workspace = Boolean(activeAnalysis && !ws21Approved && !hasStyledBaselineReport)
  useEffect(() => {
    if (!activeAnalysis || !shouldAutoBuildBaseline) return

    const requiredAgents = [
      'ws2_3_rev_vertical_v1',
      'ws2_4_benchmark_v1',
      'ws2_5_labor_v1',
      'ws2_10_report_generator_v1',
    ] as const
    const initialDerivedStatus = new Map((activeAnalysis.derivedReports ?? []).map((report) => [report.agentId, report.status]))
    const alreadyComplete = requiredAgents.every((agentId) => initialDerivedStatus.get(agentId) === 'COMPLETE')
    if (alreadyComplete) return

    if (baselineBuildState.running && baselineBuildState.analysisId === activeAnalysis.id) return

    let cancelled = false

    const runDerivedAgent = async (
      agentId: (typeof requiredAgents)[number],
      stepLabel: string,
      currentAnalysis: TtmAnalysisView,
    ) => {
      const currentDerivedStatus = new Map((currentAnalysis.derivedReports ?? []).map((report) => [report.agentId, report.status]))
      if (currentDerivedStatus.get(agentId) === 'COMPLETE') return currentAnalysis

      const preparedDocuments =
        agentId === 'ws2_5_labor_v1' && documentStatuses.owner_gm_assessment?.fileName
          ? await Promise.all([
              prepareWs2DocumentFromServer({
                clientId,
                documentId: 'owner_gm_assessment',
                fileName: documentStatuses.owner_gm_assessment.fileName,
              }),
            ])
          : []

      setBaselineBuildState({
        analysisId: currentAnalysis.id,
        running: true,
        step: stepLabel,
        error: null,
      })
      logWs2ClientEvent('WS2 auto baseline step', {
        analysisId: currentAnalysis.id,
        agentId,
        stepLabel,
        preparedDocumentIds: preparedDocuments.map((doc) => doc.documentId),
      })

      const res = await fetch('/api/ttm-agent/derived', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: currentAnalysis.id,
          agentId,
          preparedDocuments,
        }),
      })
      await logWs2Response(`WS2 auto baseline ${agentId}`, res)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Failed while running ${stepLabel}`)
      }

      const updated = (await res.json()) as TtmAnalysisView
      if (cancelled) return currentAnalysis
      handleUpdatedAnalysis(updated)
      return updated
    }

    void (async () => {
      try {
        let currentAnalysis = activeAnalysis

        currentAnalysis =
          (await runDerivedAgent('ws2_3_rev_vertical_v1', 'Running WS2-3 Revenue by Vertical', currentAnalysis)) ?? currentAnalysis
        currentAnalysis =
          (await runDerivedAgent('ws2_4_benchmark_v1', 'Running WS2-4 Expense Benchmarks', currentAnalysis)) ?? currentAnalysis
        currentAnalysis =
          (await runDerivedAgent('ws2_5_labor_v1', 'Running WS2-5 Labor Analysis', currentAnalysis)) ?? currentAnalysis

        const baselineAfterLabor = currentAnalysis.derivedReports?.find((report) => report.agentId === 'ws2_10_report_generator_v1')
        if (baselineAfterLabor?.status !== 'COMPLETE') {
          currentAnalysis =
            (await runDerivedAgent('ws2_10_report_generator_v1', 'Assembling the full baseline valuation report', currentAnalysis)) ?? currentAnalysis
        } else {
          logWs2ClientEvent('WS2 auto baseline step', {
            analysisId: currentAnalysis.id,
            agentId: 'ws2_10_report_generator_v1',
            stepLabel: 'Baseline report already assembled after WS2-5 completed',
          })
        }
        if (cancelled) return
        setBaselineBuildState({
          analysisId: currentAnalysis.id,
          running: false,
          step: null,
          error: null,
        })
        await loadAnalyses().catch(() => {})
      } catch (buildError) {
        if (cancelled) return
        logWs2Error('WS2 auto baseline build', buildError, {
          analysisId: activeAnalysis.id,
        })
        setBaselineBuildState({
          analysisId: activeAnalysis.id,
          running: false,
          step: null,
          error: buildError instanceof Error ? buildError.message : 'Failed to finish the baseline build sequence',
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    activeAnalysis,
    baselineBuildState.analysisId,
    baselineBuildState.running,
    clientId,
    documentStatuses.owner_gm_assessment?.fileName,
    handleUpdatedAnalysis,
    hasStyledBaselineReport,
    latestRecast?.status,
    loadAnalyses,
    shouldAutoBuildBaseline,
    ws21Approved,
  ])

  useEffect(() => {
    if (!activeAnalysis) return
    if ((derivedByAgent.get('ws2_10_report_generator_v1')?.status ?? null) !== 'COMPLETE') return
    if (!baselineBuildState.running && !baselineBuildState.error) return

    setBaselineBuildState((current) => ({
      analysisId: activeAnalysis.id,
      running: false,
      step: null,
      error: current.error,
    }))
  }, [activeAnalysis, baselineBuildState.error, baselineBuildState.running, derivedByAgent])

  useEffect(() => {
    if (!activeAnalysis || !hasStyledBaselineReport) return
    if (!baselineBuildState.running && !baselineBuildState.error && baselineBuildState.analysisId !== activeAnalysis.id) return

    setBaselineBuildState((current) => ({
      analysisId: activeAnalysis.id,
      running: false,
      step: null,
      error: current.error,
    }))
  }, [activeAnalysis, baselineBuildState.analysisId, baselineBuildState.error, baselineBuildState.running, hasStyledBaselineReport])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 cantara-serif">WS2 Analysis Workspace</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Upload the core financial files, run WS2-1, review only the flagged items, then approve to unlock EBITDA and the baseline valuation report.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadAnalyses()}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel} disabled={!activeAnalysis}>
            <Download className="w-3.5 h-3.5" />
            Export XLSX
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
            <h4 className="text-sm font-semibold text-slate-800">Before You Run</h4>
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
            <h4 className="text-sm font-semibold text-slate-800">How This Flows</h4>
          </div>
          <div className="mt-4 space-y-3">
            {[
              'Run WS2-1 to build the TTM model and identify only the sections that need review.',
              'Resolve the review queue. Supporting detail stays collapsed until you open it.',
              'Approve WS2-1 to unlock WS2-2 EBITDA recast and the full valuation report.',
            ].map((step) => (
              <div key={step} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                {step}
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Run Status</p>
            <p className="mt-2 text-sm text-slate-700">
              {readyToRun ? 'All required WS2-1 source documents are present.' : 'Upload all required WS2-1 source documents before running the agent.'}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              QuickBooks remains optional. Section B will stay marked as skipped until that connection exists.
            </p>
          </div>
        </Card>
      </div>

      {activeAnalysis ? (
        <div className="space-y-6">
          <section id="ws210-report" className="scroll-mt-24">
          <BaselineValuationReportPanel
            clientName={clientName}
            analysis={activeAnalysis}
            onUpdated={handleUpdatedAnalysis}
            onExportXlsx={exportToExcel}
            hideWorkflowChrome={hasStyledBaselineReport}
            collapsed={collapsedSections['ws210-report']}
            onToggleCollapse={() => toggleSection('ws210-report')}
          />
          </section>
          {baselineBuildState.running && baselineBuildState.analysisId === activeAnalysis.id && !hasStyledBaselineReport && (
            <Card className="border-amber-200 bg-amber-50/70 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">Building the baseline valuation report</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {baselineBuildState.step ?? 'Running downstream WS2 reports...'}
                  </p>
                </div>
              </div>
            </Card>
          )}
          {baselineBuildState.error && baselineBuildState.analysisId === activeAnalysis.id && !hasStyledBaselineReport && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {baselineBuildState.error}
            </div>
          )}
          {!hasStyledBaselineReport && (
          <>
          {showWs21Workspace && (
            <Ws21ReviewWorkspace
              analysis={activeAnalysis}
              actorName={adminName}
              onUpdated={handleUpdatedAnalysis}
            />
          )}
          {/* WS2-2 Recast Panel — visible after WS2-1 approval */}
          {ws21Approved && (
            <section id="ws22-recast" className="scroll-mt-24">
            <Ws2RecastPanel
              analysis={activeAnalysis}
              clientId={clientId}
              adminName={adminName}
              documentStatuses={documentStatuses}
              onUpdated={handleUpdatedAnalysis}
              collapsed={collapsedSections['ws22-recast']}
              onToggleCollapse={() => toggleSection('ws22-recast')}
            />
            </section>
          )}
          </>
          )}

          {/* GL Mapping Reference */}
          {activeAnalysis.normalizedData?.mappedPlRows && Array.isArray(activeAnalysis.normalizedData.mappedPlRows) && (activeAnalysis.normalizedData.mappedPlRows as Array<{ accountName: string; accountCode: string | null; cantaraCode: string | null; total: number }>).length > 0 && (
            <Card className="p-5 mt-6">
              <h4 className="text-sm font-semibold text-slate-800 mb-4">GL Code Mapping Reference</h4>
              <p className="text-xs text-slate-400 mb-3">Finalized mapping of source GL codes to Cantara categories used in the analysis.</p>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-slate-200 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">GL Code</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2">Cantara Category</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(activeAnalysis.normalizedData.mappedPlRows as Array<{ accountName: string; accountCode: string | null; cantaraCode: string | null; total: number }>)
                      .filter((row) => row.accountCode)
                      .map((row, i) => (
                        <tr key={`${row.accountCode}-${i}`}>
                          <td className="px-3 py-1.5 text-slate-500 font-mono text-xs">{row.accountCode ?? '—'}</td>
                          <td className="px-3 py-1.5 text-slate-700">{row.accountName}</td>
                          <td className="px-3 py-1.5 text-slate-500">{row.cantaraCode ?? 'UNMAPPED'}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums text-slate-700">
                            {typeof row.total === 'number' && Number.isFinite(row.total)
                              ? `$${Math.round(row.total).toLocaleString()}`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      ) : loadingAnalyses ? (
        <Card className="p-8">
          <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading WS2 analysis...
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center text-sm text-slate-400">
          No WS2-1 runs yet. Upload the required valuation documents in the client Collection flow, then run the agent here.
        </Card>
      )}
    </div>
  )
}
