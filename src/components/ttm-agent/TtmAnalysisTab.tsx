'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Play, AlertCircle, RefreshCw } from 'lucide-react'
import { buildWS2ReportAdapter } from '@/lib/ttm-agent/export-adapter'
import { exportWS2Workbook } from '@/lib/ws2/ws2-export'
import { Badge, Button, Card, Input } from '@/components/ui'
import { Ws2RecastPanel } from '@/components/ttm-agent/Ws2RecastPanel'
import { BaselineValuationReportPanel } from '@/components/ttm-agent/BaselineValuationReportPanel'
import { Ws21ReviewWorkspace } from '@/components/ttm-agent/Ws21ReviewWorkspace'
import { logWs2ClientEvent, logWs2Error, logWs2PreparedDocuments, logWs2Response } from '@/lib/ttm-agent/browser-debug'
import { prepareWs2DocumentFromServer } from '@/lib/ttm-agent/browser-documents'
import { CANTARA_TAXONOMY, TAXONOMY_BY_CODE } from '@/lib/ttm-agent/taxonomy'
import type { DocumentStatus } from '@/lib/store'
import type { MappedLedgerRow, TtmAnalysisView, TtmRequiredDocumentId } from '@/lib/ttm-agent/types'

const REQUIRED_DOCS: Array<{ id: TtmRequiredDocumentId; label: string }> = [
  { id: 'monthly_pl_excel', label: 'Monthly P&L (36 months)' },
  { id: 'monthly_bs_excel', label: 'Monthly Balance Sheet (36 months)' },
]


// ── Step 3: Clean valuation range entry ─────────────────────────────────────
function Step3ValuationRange({
  analysis, clientId, adminName, documentStatuses, onUpdated, baselineBuildError, onBack,
}: {
  analysis: TtmAnalysisView; clientId: string; adminName: string; documentStatuses: Record<string, DocumentStatus>
  onUpdated: (a: TtmAnalysisView) => void; baselineBuildError: string | null; onBack: () => void
}) {
  const [low, setLow] = useState(''); const [mid, setMid] = useState(''); const [high, setHigh] = useState('')
  const [running, setRunning] = useState(false); const [error, setError] = useState<string | null>(null)
  const [savingFlagId, setSavingFlagId] = useState<string | null>(null)
  const latestRecast = analysis.recastAnalyses?.[0] ?? null
  const isApproved = latestRecast?.status === 'APPROVED'
  const unresolvedFlags = latestRecast?.flags.filter(f => f.resolutionStatus !== 'ACTIONED') ?? []
  const canRun = low.trim() && mid.trim() && high.trim()
  const canApprove = latestRecast && !isApproved && unresolvedFlags.length === 0
  const parseNum = (v: string) => { const n = Number(v.trim().replace(/,/g, '')); return Number.isFinite(n) ? n : null }
  const fmtCurrency = (v: number | null | undefined) => typeof v === 'number' && Number.isFinite(v) ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'
  const fmtMultiple = (v: number | null | undefined) => typeof v === 'number' && Number.isFinite(v) ? `${v.toFixed(1)}x` : '—'

  const resolveFlag = async (flagId: string, action: 'RESOLVE' | 'ESCALATE_CLIENT') => {
    if (!latestRecast) return; setSavingFlagId(flagId)
    try {
      const res = await fetch('/api/ttm-agent/recast', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'flag', recastAnalysisId: latestRecast.id, flagId, resolutionAction: action, resolutionNotes: '', actorName: adminName }) })
      if (!res.ok) throw new Error(await res.text().catch(() => 'Failed')); onUpdated(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to resolve flag') } finally { setSavingFlagId(null) }
  }

  const runRecast = async () => {
    setRunning(true); setError(null)
    try {
      const assumptions = { multipleLow: parseNum(low), multipleMid: parseNum(mid), multipleHigh: parseNum(high), replacementSalary: null, relatedPartyOwnership: false, fmrEstimate: null, notes: null }
      const preparedDocuments = await Promise.all(Object.entries(documentStatuses).filter(([, s]) => s?.fileName).slice(0, 5).map(([docId, s]) => prepareWs2DocumentFromServer({ clientId, documentId: docId as any, fileName: s.fileName || docId })))
      const res = await fetch('/api/ttm-agent/recast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'run', analysisId: analysis.id, assumptions, preparedDocuments }) })
      if (!res.ok) throw new Error(await res.text().catch(() => 'Failed')); onUpdated(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to run valuation') } finally { setRunning(false) }
  }

  const approveRecast = async () => {
    if (!latestRecast) return; setRunning(true)
    try {
      const res = await fetch('/api/ttm-agent/recast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'approve', recastAnalysisId: latestRecast.id, actorName: adminName }) })
      if (!res.ok) throw new Error(await res.text().catch(() => 'Approval failed')); onUpdated(await res.json())
    } catch (e) { setError(e instanceof Error ? e.message : 'Approval failed') } finally { setRunning(false) }
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h4 className="text-sm font-semibold text-slate-800 mb-1">Set Valuation Multiples</h4>
        <p className="text-xs text-slate-400 mb-5">Enter low, mid, and high EBITDA multiples, then click Run.</p>
        <div className="grid grid-cols-3 gap-4 max-w-lg">
          <Input label="Low multiple" value={low} onChange={e => setLow(e.target.value)} placeholder="3.5" />
          <Input label="Mid multiple" value={mid} onChange={e => setMid(e.target.value)} placeholder="4.5" />
          <Input label="High multiple" value={high} onChange={e => setHigh(e.target.value)} placeholder="5.5" />
        </div>
        <div className="mt-5">
          <Button onClick={() => void runRecast()} disabled={!canRun || running}>
            {running ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running...</> : <><Play className="w-3.5 h-3.5" /> Run Valuation</>}
          </Button>
        </div>
        {error && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {baselineBuildError && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{baselineBuildError}</div>}
      </Card>
      {latestRecast && (
        <>
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-slate-800">Valuation Result</h4>
              {isApproved ? (<Badge color="green">Approved</Badge>) : (
                <Button size="sm" onClick={() => void approveRecast()} disabled={!canApprove || running}>
                  {unresolvedFlags.length > 0 ? `Resolve ${unresolvedFlags.length} flag${unresolvedFlags.length > 1 ? 's' : ''} first` : 'Approve & Continue →'}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Low · {fmtMultiple(latestRecast.assumptions.multipleLow)}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">{fmtCurrency(latestRecast.valuationLow)}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-800 p-4 text-center text-white">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Mid · {fmtMultiple(latestRecast.assumptions.multipleMid)}</p>
                <p className="mt-2 text-2xl font-semibold text-amber-300 tabular-nums">{fmtCurrency(latestRecast.valuationMid)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">High · {fmtMultiple(latestRecast.assumptions.multipleHigh)}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">{fmtCurrency(latestRecast.valuationHigh)}</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">Based on Normalized EBITDA of <span className="font-semibold text-slate-700">{fmtCurrency(latestRecast.normalizedEbitda)}</span></p>
          </Card>
          {unresolvedFlags.length > 0 && (
            <Card className="p-5">
              <h4 className="text-sm font-semibold text-slate-800 mb-1">Add-Back Flags</h4>
              <p className="text-xs text-slate-400 mb-4">The AI flagged {unresolvedFlags.length} add-back item{unresolvedFlags.length > 1 ? 's' : ''} for review. Accept or remove each to unlock approval.</p>
              <div className="space-y-3">
                {unresolvedFlags.map(flag => (
                  <div key={flag.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{flag.title}</p>
                      {flag.description && flag.description !== flag.title && (<p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{flag.description}</p>)}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button size="sm" variant="outline" disabled={savingFlagId === flag.id} onClick={() => void resolveFlag(flag.id, 'RESOLVE')}>Accept</Button>
                      <Button size="sm" variant="outline" disabled={savingFlagId === flag.id} onClick={() => void resolveFlag(flag.id, 'ESCALATE_CLIENT')}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
      <div className="flex justify-start"><Button variant="outline" size="sm" onClick={onBack}>← Back to GL Mapping</Button></div>
    </div>
  )
}

function glMappingKey(row: Pick<MappedLedgerRow, 'sourceSheet' | 'accountCode' | 'accountName'>) {
  return `${row.sourceSheet ?? ''}|${row.accountCode ?? ''}|${row.accountName ?? ''}`
}

function asMappedRows(value: unknown) {
  return Array.isArray(value) ? (value as MappedLedgerRow[]) : []
}

function GlMappingEditor({
  analysis,
  onUpdated,
}: {
  analysis: TtmAnalysisView
  onUpdated: (analysis: TtmAnalysisView) => void
}) {
  const rows = useMemo(() => {
    const mappedPlRows = asMappedRows(analysis.normalizedData?.mappedPlRows)
    const mappedBsRows = asMappedRows(analysis.normalizedData?.mappedBsRows)
    return [...mappedPlRows, ...mappedBsRows]
      .filter((row) => row.cantaraCode !== '_EXCLUDED')
      .sort((a, b) => String(a.accountCode ?? '').localeCompare(String(b.accountCode ?? '')) || a.accountName.localeCompare(b.accountName))
  }, [analysis.normalizedData])
  const [selectedByKey, setSelectedByKey] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setSelectedByKey(Object.fromEntries(rows.map((row) => [glMappingKey(row), row.cantaraCode ?? ''])))
    setMessage(null)
  }, [rows])

  const dirtyCount = rows.filter((row) => (selectedByKey[glMappingKey(row)] ?? '') !== (row.cantaraCode ?? '')).length

  const submitMappings = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const mappings = Object.fromEntries(rows.map((row) => [glMappingKey(row), selectedByKey[glMappingKey(row)] || null]))
      const res = await fetch('/api/ttm-agent/hitl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'save-gl-mappings',
          analysisId: analysis.id,
          mappings,
        }),
      })
      if (!res.ok) throw new Error(await res.text().catch(() => 'Failed to save GL mappings'))
      const updated = (await res.json()) as TtmAnalysisView
      onUpdated(updated)
      setMessage('GL mappings saved.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save GL mappings')
    } finally {
      setSaving(false)
    }
  }

  if (!rows.length) return (
    <Card className="p-5 mt-6">
      <p className="text-sm text-slate-500">No GL rows available yet. Complete Step 1 to generate mappings.</p>
    </Card>
  )

  return (
    <Card className="p-5 mt-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">GL Code Mapping</h4>
          <p className="text-xs text-slate-400 mt-1">Review and adjust Cantara category assignments. Submit any changes before continuing.</p>
        </div>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 && <Badge color="gold">{dirtyCount} changed</Badge>}
          <Button size="sm" disabled={saving || dirtyCount === 0} onClick={submitMappings}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Submit mappings
          </Button>
        </div>
      </div>
      {message && <p className="mb-3 text-xs text-slate-500">{message}</p>}
      <div className="overflow-x-auto max-h-[460px] overflow-y-auto rounded-lg border border-slate-200">
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
            {rows.map((row) => {
              const key = glMappingKey(row)
              const selected = selectedByKey[key] ?? ''
              const selectedEntry = selected ? TAXONOMY_BY_CODE[selected] : null
              return (
                <tr key={key}>
                  <td className="px-3 py-2 text-slate-500 font-mono text-xs">{row.accountCode ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-700">{row.accountName}</td>
                  <td className="px-3 py-2">
                    <select
                      value={selected}
                      onChange={(event) => setSelectedByKey((current) => ({ ...current, [key]: event.target.value }))}
                      className="w-full min-w-[260px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-amber-400"
                    >
                      <option value="">UNMAPPED</option>
                      {CANTARA_TAXONOMY.map((entry) => (
                        <option key={entry.code} value={entry.code}>
                          {entry.code} - {entry.category}
                        </option>
                      ))}
                    </select>
                    {selectedEntry && <p className="mt-1 text-[11px] text-slate-400">{selectedEntry.type}</p>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                    {typeof row.total === 'number' && Number.isFinite(row.total)
                      ? `$${Math.round(row.total).toLocaleString()}`
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
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


  const runAgent = async () => {
    setRunning(true)
    setError(null)
    setWizardStep(1)
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
  const isFailed = activeAnalysis?.status === 'FAILED'
  const showWs21Workspace = Boolean(activeAnalysis && !ws21Approved && !isFailed && !hasStyledBaselineReport)
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

  // ── Step-based wizard state ──────────────────────────────────────────
  // Step 1: Flags review (resolve GL mapping + data quality flags)
  // Step 2: GL mapping final review (editable table with Cantara categories)
  // Step 3: Valuation range input (WS2-2 recast)
  // Step 4: Final workbook (editable report with all tabs)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1)

  // Auto-advance wizard based on analysis state (but not while running)
  useEffect(() => {
    if (!activeAnalysis || running) return
    if (isFailed) { setWizardStep(1); return }
    if (hasStyledBaselineReport) { setWizardStep(4); return }
    if (ws21Approved) { setWizardStep(3); return }
    // New analysis pending review → step 1
    if (activeAnalysis.status === 'HITL_PENDING') { setWizardStep(1); return }
  }, [activeAnalysis, isFailed, ws21Approved, hasStyledBaselineReport, running])

  const unresolvedFlags = activeAnalysis?.flags.filter(f => f.resolutionStatus !== 'ACTIONED').length ?? 0
  const canApproveWs21 = activeAnalysis && !isFailed && unresolvedFlags === 0 && !ws21Approved

  return (
    <div className="space-y-6">
      {/* Header with step indicator */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 cantara-serif">Financial Analysis & Valuation</h3>
          {activeAnalysis && !isFailed && (
            <div className="flex items-center gap-1 mt-2">
              {[
                { n: 1, label: 'Accept / Exclude / Escalate' },
                { n: 2, label: 'Review GL Mapping' },
                { n: 3, label: 'Set Valuation Range' },
                { n: 4, label: 'Workbook & Report' },
              ].map(({ n, label }) => {
                const isActive = wizardStep === n
                const isDone = wizardStep > n || (n === 1 && ws21Approved) || (n === 3 && hasStyledBaselineReport)
                return (
                  <button
                    key={n}
                    onClick={() => setWizardStep(n as 1 | 2 | 3 | 4)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isActive ? 'bg-cantara-navy text-white' : isDone ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isDone && !isActive ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-4 text-center">{n}</span>}
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        {activeAnalysis && (
          <Button variant="outline" size="sm" onClick={() => void runAgent()} disabled={!readyToRun || running}>
            <RefreshCw className="w-3.5 h-3.5" />
            {running ? 'Running...' : 'Start New Analysis'}
          </Button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loadingAnalyses && !activeAnalysis && (
        <Card className="p-8">
          <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        </Card>
      )}

      {/* No analysis yet */}
      {!activeAnalysis && !loadingAnalyses && (
        <Card className="p-6">
          <div className="space-y-4">
            {readyToRun ? (
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                All required documents uploaded
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Upload Required Documents</p>
                {readiness.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 text-sm">
                    {item.uploaded ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-300" />}
                    <span className={item.uploaded ? 'text-slate-600' : 'text-slate-800 font-medium'}>{item.label}</span>
                    {item.fileName && <span className="text-xs text-slate-400">({item.fileName})</span>}
                  </div>
                ))}
              </div>
            )}
            <Button size="sm" onClick={() => void runAgent()} disabled={!readyToRun || running}>
              {running ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing...</> : <><Play className="w-3.5 h-3.5" /> Run Analysis</>}
            </Button>
          </div>
        </Card>
      )}

      {/* Running progress */}
      {activeAnalysis && (running || baselineBuildState.running) && (
        <Card className="border-amber-200 bg-amber-50/70 p-5">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-slate-800">{running ? 'Analyzing financial data...' : 'Generating valuation report...'}</p>
              <p className="mt-1 text-sm text-slate-600">{running ? 'Building financial model.' : (baselineBuildState.step ?? 'Running...')}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Failed */}
      {activeAnalysis && isFailed && (
        <Card className="border-rose-200 bg-rose-50 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-rose-800">Analysis Failed</p>
              <p className="mt-1 text-sm text-rose-700">The uploaded P&L file couldn't be processed. Verify it contains monthly data with labeled revenue lines, then start a new analysis.</p>
            </div>
          </div>
        </Card>
      )}

      {/* ═══════════════ STEP 1: Review Flags ═══════════════ */}
      {activeAnalysis && !isFailed && !running && wizardStep === 1 && (
        <div className="space-y-4">
          {ws21Approved ? (
            <Card className="border-emerald-200 bg-emerald-50/60 p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <p className="text-sm font-semibold text-emerald-800">Step 1 complete — all flags resolved and approved.</p>
                </div>
                <Button size="sm" onClick={() => setWizardStep(2)}>Continue to GL Mapping →</Button>
              </div>
            </Card>
          ) : (
            <>
              <Ws21ReviewWorkspace
                analysis={activeAnalysis}
                actorName={adminName}
                onUpdated={handleUpdatedAnalysis}
              />
              {canApproveWs21 && (
                <div className="sticky bottom-0 z-10 bg-white/90 backdrop-blur border-t border-slate-200 px-4 py-3 -mx-4 flex justify-end">
                  <Button size="sm" onClick={() => setWizardStep(2)}>
                    Next: Review GL Mapping →
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════ STEP 2: GL Mapping Review ═══════════════ */}
      {activeAnalysis && !isFailed && wizardStep === 2 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Review the GL code mappings below. Adjust any that look wrong, then continue to set the valuation range.
          </div>
          <GlMappingEditor analysis={activeAnalysis} onUpdated={handleUpdatedAnalysis} />
          <div className="sticky bottom-0 z-10 bg-white/90 backdrop-blur border-t border-slate-200 px-4 py-3 -mx-4 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setWizardStep(1)}>
              ← Back to Flags
            </Button>
            {!ws21Approved ? (
              <Button size="sm" onClick={() => {
                // Trigger the approve action from AdminReviewDashboard
                fetch('/api/ttm-agent/hitl', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ mode: 'approve', analysisId: activeAnalysis.id, actorName: adminName }),
                }).then(res => res.ok ? res.json() : Promise.reject(new Error('Approval failed')))
                  .then(updated => { handleUpdatedAnalysis(updated); setWizardStep(3) })
                  .catch(err => setError(err instanceof Error ? err.message : 'Approval failed'))
              }}>
                Approve & Set Valuation Range →
              </Button>
            ) : (
              <Button size="sm" onClick={() => setWizardStep(3)}>
                Next: Set Valuation Range →
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════ STEP 3: Valuation Range ═══════════════ */}
      {activeAnalysis && ws21Approved && wizardStep === 3 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Enter low, mid, and high EBITDA multiples to generate a valuation range. The AI will apply these to the normalized EBITDA and flag any add-backs for your review.
          </div>
          <Step3ValuationRange
            analysis={activeAnalysis}
            clientId={clientId}
            adminName={adminName}
            documentStatuses={documentStatuses}
            onUpdated={handleUpdatedAnalysis}
            baselineBuildError={baselineBuildState.error}
            onBack={() => setWizardStep(2)}
          />
        </div>
      )}

      {/* ═══════════════ STEP 4: Final Report / Workbook ═══════════════ */}
      {activeAnalysis && hasStyledBaselineReport && wizardStep === 4 && (
        <div className="space-y-4">
          <BaselineValuationReportPanel
            clientName={clientName}
            analysis={activeAnalysis}
            onUpdated={handleUpdatedAnalysis}
            onExportXlsx={exportToExcel}
            hideWorkflowChrome={true}
            collapsed={false}
            onToggleCollapse={() => {}}
          />
        </div>
      )}
    </div>
  )
}
