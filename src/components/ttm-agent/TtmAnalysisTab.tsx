'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileSpreadsheet, Loader2, Play, RefreshCw, ShieldAlert } from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'
import { CraigReviewDashboard } from '@/components/ttm-agent/CraigReviewDashboard'
import { TrendCharts } from '@/components/ttm-agent/TrendCharts'
import { WCSummary } from '@/components/ttm-agent/WCSummary'
import { Ws2RecastPanel } from '@/components/ttm-agent/Ws2RecastPanel'
import { Ws2DerivedReportsPanel } from '@/components/ttm-agent/Ws2DerivedReportsPanel'
import { BaselineValuationReportPanel } from '@/components/ttm-agent/BaselineValuationReportPanel'
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

function SectionShell({
  id,
  title,
  description,
  collapsed,
  onToggle,
  children,
}: {
  id: string
  title: string
  description?: string
  collapsed: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
            {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
          </div>
          <Button size="sm" variant="outline" onClick={onToggle}>
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {collapsed ? 'Expand' : 'Collapse'}
          </Button>
        </div>
        {!collapsed && children}
      </Card>
    </section>
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
  const [collapsedSections, setCollapsedSections] = useState<Record<Ws2SectionKey, boolean>>(DEFAULT_SECTION_STATE)

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
    if (!running) return
    const interval = setInterval(() => {
      loadAnalyses().catch(() => {})
    }, 5000)
    return () => clearInterval(interval)
  }, [loadAnalyses, running])

  const activeAnalysis = analyses.find((analysis) => analysis.id === activeAnalysisId) ?? analyses[0] ?? null

  useEffect(() => {
    setCollapsedSections((current) => {
      const next = { ...DEFAULT_SECTION_STATE, ...current }
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
      return next
    })
  }, [activeAnalysisId, activeAnalysis?.status, activeAnalysis?.recastAnalyses])

  const toggleSection = (section: Ws2SectionKey) => {
    setCollapsedSections((current) => ({
      ...current,
      [section]: !current[section],
    }))
  }

  const setAllSections = (collapsed: boolean) => {
    setCollapsedSections({
      'ws21-pack': collapsed,
      'ws21-report': collapsed,
      'ws21-trends': collapsed,
      'ws21-working-capital': collapsed,
      'ws21-review': collapsed,
      'ws22-recast': collapsed,
      'ws23-report': collapsed,
      'ws24-report': collapsed,
      'ws25-report': collapsed,
      'ws210-report': collapsed,
    })
  }

  const navigateToSection = (item: { key: Ws2SectionKey; href: string }) => {
    const targetId = item.href.replace(/^#/, '')

    setCollapsedSections({
      'ws21-pack': true,
      'ws21-report': true,
      'ws21-trends': true,
      'ws21-working-capital': true,
      'ws21-review': true,
      'ws22-recast': true,
      'ws23-report': true,
      'ws24-report': true,
      'ws25-report': true,
      'ws210-report': true,
      [item.key]: false,
    })

    window.setTimeout(() => {
      window.history.replaceState(null, '', item.href)
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
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

  const latestRecast = activeAnalysis?.recastAnalyses?.[0] ?? null
  const derivedByAgent = new Map((activeAnalysis?.derivedReports ?? []).map((report) => [report.agentId, report]))
  const ws23Href = derivedByAgent.get('ws2_3_rev_vertical_v1') ? '#ws23-report-detail' : '#ws23-report'
  const ws24Href = derivedByAgent.get('ws2_4_benchmark_v1') ? '#ws24-report-detail' : '#ws24-report'
  const ws25Href = derivedByAgent.get('ws2_5_labor_v1') ? '#ws25-report-detail' : '#ws25-report'
  const ws210Href = derivedByAgent.get('ws2_10_report_generator_v1') ? '#ws210-report-detail' : '#ws210-report'
  const navItems = activeAnalysis
    ? [
        {
          key: 'ws21-pack' as const,
          href: '#ws21-pack',
          label: 'WS2-1 Analysis',
          meta: `${activeAnalysis.flags.filter((flag) => flag.resolutionStatus !== 'ACTIONED').length} open`,
        },
        {
          key: 'ws22-recast' as const,
          href: '#ws22-recast',
          label: 'WS2-2 EBITDA',
          meta: latestRecast?.status ?? 'Not Run',
        },
        {
          key: 'ws23-report' as const,
          href: ws23Href,
          label: 'WS2-3 Revenue',
          meta: derivedByAgent.get('ws2_3_rev_vertical_v1')?.status ?? 'Not Run',
        },
        {
          key: 'ws24-report' as const,
          href: ws24Href,
          label: 'WS2-4 Benchmarks',
          meta: derivedByAgent.get('ws2_4_benchmark_v1')?.status ?? 'Not Run',
        },
        {
          key: 'ws25-report' as const,
          href: ws25Href,
          label: 'WS2-5 Labor',
          meta: derivedByAgent.get('ws2_5_labor_v1')?.status ?? 'Not Run',
        },
        {
          key: 'ws210-report' as const,
          href: ws210Href,
          label: 'Baseline Valuation Report',
          meta: derivedByAgent.get('ws2_10_report_generator_v1')?.status ?? 'Not Run',
        },
      ]
    : []

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
        <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-24 xl:self-start">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">WS2 Timeline</h4>
                  <p className="text-xs text-slate-400 mt-1">Jump to any stage and collapse the rest.</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {navItems.map((item, index) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => navigateToSection(item)}
                    className="flex w-full items-start gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left transition hover:border-amber-300 hover:bg-amber-50"
                  >
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{item.label}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.meta}</p>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-2">
                <Button size="sm" variant="outline" onClick={() => setAllSections(true)}>
                  Collapse All
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAllSections(false)}>
                  Expand All
                </Button>
              </div>
            </Card>
          </aside>

          <div className="space-y-6">
          <section id="ws21-pack" className="scroll-mt-24">
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
                <Button size="sm" variant="outline" onClick={() => toggleSection('ws21-pack')}>
                  {collapsedSections['ws21-pack'] ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {collapsedSections['ws21-pack'] ? 'Expand Section' : 'Collapse Section'}
                </Button>
              </div>
            </div>

            {collapsedSections['ws21-pack'] ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                WS2-1 overview is collapsed. Use the timeline to jump back here when needed.
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
          </section>

          {activeAnalysis.reportMarkdown && (
            <SectionShell
              id="ws21-report"
              title="WS2-1 Report"
              description="Produced by WS2-1 TTM Financial Analysis Agent."
              collapsed={collapsedSections['ws21-report']}
              onToggle={() => toggleSection('ws21-report')}
            >
              <div className="prose prose-slate max-w-none mt-4 text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeAnalysis.reportMarkdown}</ReactMarkdown>
              </div>
            </SectionShell>
          )}

          <SectionShell
            id="ws21-trends"
            title="Trend Charts"
            description="Revenue, margin, and EBITDA trends from the structured model."
            collapsed={collapsedSections['ws21-trends']}
            onToggle={() => toggleSection('ws21-trends')}
          >
            <div className="mt-4">
              <TrendCharts annualModel={activeAnalysis.annualModel} />
            </div>
          </SectionShell>
          <SectionShell
            id="ws21-working-capital"
            title="Working Capital"
            description="Net working capital summary and review support."
            collapsed={collapsedSections['ws21-working-capital']}
            onToggle={() => toggleSection('ws21-working-capital')}
          >
            <div className="mt-4">
              <WCSummary summary={activeAnalysis.workingCapital} />
            </div>
          </SectionShell>
          <section id="ws21-review" className="scroll-mt-24">
            <CraigReviewDashboard
              analysis={activeAnalysis}
              actorName={adminName}
              onUpdated={handleUpdatedAnalysis}
              collapsed={collapsedSections['ws21-review']}
              onToggleCollapse={() => toggleSection('ws21-review')}
            />
          </section>
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
          <section id="ws23-report" className="scroll-mt-24">
          <Ws2DerivedReportsPanel
            analysis={activeAnalysis}
            clientId={clientId}
            documentStatuses={documentStatuses}
            onUpdated={handleUpdatedAnalysis}
            collapsed={
              collapsedSections['ws23-report'] &&
              collapsedSections['ws24-report'] &&
              collapsedSections['ws25-report']
            }
            onToggleCollapse={() => {
              const nextCollapsed =
                !(
                  collapsedSections['ws23-report'] &&
                  collapsedSections['ws24-report'] &&
                  collapsedSections['ws25-report']
                )
              setCollapsedSections((current) => ({
                ...current,
                'ws23-report': nextCollapsed,
                'ws24-report': nextCollapsed,
                'ws25-report': nextCollapsed,
              }))
            }}
          />
          </section>
          <section id="ws210-report" className="scroll-mt-24">
          <BaselineValuationReportPanel
            analysis={activeAnalysis}
            onUpdated={handleUpdatedAnalysis}
            collapsed={collapsedSections['ws210-report']}
            onToggleCollapse={() => toggleSection('ws210-report')}
          />
          </section>
          </div>
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
          No WS2-1 runs yet. Upload the four required valuation documents in the client Collection flow, then run the agent here.
        </Card>
      )}
    </div>
  )
}
