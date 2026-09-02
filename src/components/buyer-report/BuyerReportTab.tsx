'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, FileText, TrendingUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button, Card, cn } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import InlineEditableMarkdownReport from '@/components/report-export/InlineEditableMarkdownReport'
import { buildBuyerReportHtml } from '@/lib/report-export/build-buyer-report'
import { getStatusBadgeKind, isStatusCell } from '@/lib/report-export/status-cell'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'

type BuyerReport = {
  workstream: string
  workstreamLabel: string
  clientName: string
  generatedAt: string
  updatedAt?: string
  markdown: string
}

/** Map emoji status indicators to styled badges */
function StatusBadge({ text }: { text: string }) {
  const kind = getStatusBadgeKind(text)
  if (kind === 'green') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">🟢 Green</span>
  }
  if (kind === 'yellow') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">🟡 Yellow</span>
  }
  if (kind === 'red') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-semibold text-rose-700">🔴 Red</span>
  }
  return <span>{String(text ?? '')}</span>
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-5 border-b-2 border-blue-200 pb-3 text-2xl font-bold tracking-tight text-slate-900">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-3 mt-10 text-lg font-bold tracking-tight text-slate-900 border-b border-slate-200 pb-2">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-6 text-sm font-bold text-slate-800">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mb-2 mt-4 text-sm font-semibold text-slate-700">{children}</h4>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-4 text-sm leading-7 text-slate-700">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-bold text-slate-900">{children}</strong>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-5 list-disc space-y-2 pl-5 text-sm text-slate-700 marker:text-blue-500">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-slate-700 marker:text-blue-500">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-7">{children}</li>
  ),
  hr: () => <hr className="my-8 border-slate-200" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-slate-50">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => {
    const text = String(children ?? '')
    if (isStatusCell(text)) {
      return <td className="border-t border-slate-100 px-4 py-3 align-top"><StatusBadge text={text} /></td>
    }
    return <td className="border-t border-slate-100 px-4 py-3 align-top text-sm leading-6 text-slate-700">{children}</td>
  },
}

export default function BuyerReportTab({
  clientId,
  clientName,
  workstream,
}: {
  clientId: string
  clientName: string
  workstream: 'ws1' | 'ws2'
}) {
  const [report, setReport] = useState<BuyerReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [roadmapReady, setRoadmapReady] = useState(false)
  const { provider, setProvider } = useAgentAiProvider()
  const {
    runs,
    historyItems: allHistoryItems,
    activeRun: allActiveRun,
    activeId: allActiveId,
    setActiveId,
    reload: reloadRuns,
    loading: loadingRuns,
  } = useGenericAgentRuns(clientId, AGENT_RUN_KEYS.buyerReport)

  const runsForWorkstream = useMemo(
    () => runs.filter((run) => {
      const meta = run.metadata as { workstream?: string } | null | undefined
      return meta?.workstream === workstream || (!meta?.workstream && run.report && (run.report as BuyerReport).workstream === workstream)
    }),
    [runs, workstream],
  )

  const historyItems = useMemo(
    () => runsForWorkstream.map((run) => allHistoryItems.find((item) => item.id === run.id)!).filter(Boolean),
    [runsForWorkstream, allHistoryItems],
  )

  const activeRun = useMemo(
    () => runsForWorkstream.find((run) => run.id === allActiveId) ?? runsForWorkstream[0] ?? null,
    [runsForWorkstream, allActiveId],
  )

  const activeId = activeRun?.id ?? null

  const wsLabel = workstream === 'ws1' ? 'WS1 — Risk Mitigation' : 'WS2 — Profitability & Growth'

  useEffect(() => {
    if (loadingRuns) return
    if (activeRun?.report) {
      setReport(activeRun.report as BuyerReport)
      setLoading(false)
      return
    }
    void loadFromApi()
  }, [activeRun, loadingRuns, clientId, workstream])

  function selectRun(run: AgentRunHistoryItem) {
    setActiveId(run.id)
    const full = runs.find((item) => item.id === run.id)
    if (full?.report) setReport(full.report as BuyerReport)
  }

  const loadFromApi = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/buyer-report?clientId=${encodeURIComponent(clientId)}&workstream=${workstream}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setReport(data.report)
      setRoadmapReady(Boolean(data.roadmapReady))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load buyer report.')
    } finally {
      setLoading(false)
    }
  }

  const generate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/buyer-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, workstream, provider, modelId: resolveAgentModelId(provider) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate buyer report.')
      setReport(data.report)
      await saveAgentAnalysisRunClient({
        clientId,
        agentKey: AGENT_RUN_KEYS.buyerReport,
        fileName: `${clientName} — ${wsLabel} Buyer Report`,
        report: data.report,
        markdown: data.report?.markdown,
        metadata: { workstream },
        aiProvider: provider,
        aiModel: resolveAgentModelId(provider),
      })
      await reloadRuns()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate buyer report.')
    } finally {
      setGenerating(false)
    }
  }

  const html = useMemo(() =>
    report ? buildBuyerReportHtml(report) : '',
  [report])

  if (loading || loadingRuns) {
    return <div className="h-48 flex items-center justify-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-5">
      <AgentRunToolbar
        provider={provider}
        onProviderChange={setProvider}
        disabled={generating}
        historyItems={historyItems}
        activeId={activeId}
        onSelectRun={selectRun}
        activeProvider={activeRun?.aiProvider}
        activeModel={activeRun?.aiModel}
        activeVersion={activeRun?.version}
      />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">Buyer Report</h2>
          <p className="text-xs text-slate-500 mt-1">{wsLabel} — Buyer-Facing Acquisition Summary</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button size="sm" variant="outline" onClick={generate} disabled={generating || !roadmapReady} title={!roadmapReady ? 'Run the Sales Readiness Roadmap first' : undefined}>
            <RefreshCw className={cn('w-3.5 h-3.5', generating && 'animate-spin')} />
            {report ? 'Regenerate' : 'Generate Report'}
          </Button>
          {report && (
            <ExportReportButton html={html} fileName={`${clientName} - ${wsLabel} Buyer Report.pdf`} label="Export PDF" />
          )}
        </div>
      </div>

      {!roadmapReady && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Run and submit the <strong>Sales Readiness Roadmap</strong> before generating this buyer report.</div>}

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {generating && !report && (
        <Card className="p-8">
          <div className="flex items-start gap-4">
            <div className="mt-1 h-5 w-5 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800">Generating buyer report</h3>
              <p className="mt-1 text-sm text-slate-500">
                Creating a compelling buyer-facing report from all {workstream === 'ws1' ? 'risk mitigation' : 'profitability & growth'} agent findings. This takes 30-60 seconds.
              </p>
              <div className="mt-5 space-y-3">
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          </div>
        </Card>
      )}

      {report ? (
        <InlineEditableMarkdownReport
          report={report}
          markdownComponents={markdownComponents}
          onSave={async (markdown) => {
            const res = await fetch('/api/buyer-report', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clientId, workstream, markdown }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to save buyer report.')
            setReport(data.report)
          }}
        />
      ) : !generating ? (
        <Card className="p-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
            <TrendingUp className="w-7 h-7 text-blue-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Buyer Report</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Generate a buyer-facing report that presents the business to potential acquirers, highlighting strengths and opportunities based on all {workstream === 'ws1' ? 'risk mitigation' : 'profitability & growth'} agent findings.
          </p>
          <Button onClick={generate} disabled={generating || !roadmapReady}>
            Generate Buyer Report
          </Button>
        </Card>
      ) : null}
    </div>
  )
}
