'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { PremiumMarkdown } from '@/components/ttm-agent/PremiumMarkdown'
import { Badge, Button, Card } from '@/components/ui'
import { logWs2ClientEvent, logWs2Error, logWs2PreparedDocuments, logWs2Response } from '@/lib/ttm-agent/browser-debug'
import { prepareWs2DocumentFromServer } from '@/lib/ttm-agent/browser-documents'
import type { DocumentStatus } from '@/lib/store'
import type { TtmAnalysisView, Ws2DerivedAgentId } from '@/lib/ttm-agent/types'

type CoreDerivedAgentId = Exclude<Ws2DerivedAgentId, 'ws2_10_report_generator_v1'>

const AGENTS: Array<{ id: CoreDerivedAgentId; title: string; description: string }> = [
  {
    id: 'ws2_3_rev_vertical_v1',
    title: 'WS2-3 Revenue by Vertical',
    description: 'Analyzes service-line revenue mix, concentration risk, and 3-year trend.',
  },
  {
    id: 'ws2_4_benchmark_v1',
    title: 'WS2-4 Expense Benchmarks',
    description: 'Compares expense structure against Cantara benchmark ranges.',
  },
  {
    id: 'ws2_5_labor_v1',
    title: 'WS2-5 Labor Analysis',
    description: 'Evaluates all-in labor, buyer-adjusted labor, and owner involvement.',
  },
]

const SECTION_IDS: Record<CoreDerivedAgentId, string> = {
  ws2_3_rev_vertical_v1: 'ws23-report',
  ws2_4_benchmark_v1: 'ws24-report',
  ws2_5_labor_v1: 'ws25-report',
}

const DETAIL_SECTION_IDS: Record<CoreDerivedAgentId, string> = {
  ws2_3_rev_vertical_v1: 'ws23-report-detail',
  ws2_4_benchmark_v1: 'ws24-report-detail',
  ws2_5_labor_v1: 'ws25-report-detail',
}

export function Ws2DerivedReportsPanel({
  analysis,
  clientId,
  documentStatuses,
  onUpdated,
  collapsed = false,
  onToggleCollapse,
}: {
  analysis: TtmAnalysisView
  clientId: string
  documentStatuses: Record<string, DocumentStatus>
  onUpdated: (analysis: TtmAnalysisView) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const [runningAgentId, setRunningAgentId] = useState<CoreDerivedAgentId | null>(null)
  const [error, setError] = useState<string | null>(null)

  const completedRecast =
    analysis.recastAnalyses?.find((recast) => recast.status === 'APPROVED') ??
    analysis.recastAnalyses?.find((recast) => recast.status === 'HITL_PENDING') ??
    null
  const taskByAgent = new Map(analysis.dispatchTasks.map((task) => [task.agentId, task]))

  const runAgent = async (agentId: CoreDerivedAgentId) => {
    setRunningAgentId(agentId)
    setError(null)
    try {
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
      if (preparedDocuments.length) {
        logWs2PreparedDocuments(`WS2 derived ${agentId} prepared documents`, preparedDocuments)
      }
      logWs2ClientEvent('WS2 derived run request', {
        analysisId: analysis.id,
        agentId,
        preparedDocumentIds: preparedDocuments.map((doc) => doc.documentId),
      })

      const res = await fetch('/api/ttm-agent/derived', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: analysis.id,
          agentId,
          preparedDocuments,
        }),
      })
      await logWs2Response(`WS2 derived ${agentId} response`, res)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Failed to run ${agentId}`)
      }

      onUpdated(await res.json())
    } catch (runError) {
      logWs2Error(`WS2 derived ${agentId}`, runError, {
        analysisId: analysis.id,
        agentId,
      })
      setError(runError instanceof Error ? runError.message : 'Failed to run downstream WS2 agent')
    } finally {
      setRunningAgentId(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">WS2 Derived Reports</h4>
            <p className="text-xs text-slate-400 mt-1">
              WS2-3 and WS2-4 release after Admin approves WS2-1. WS2-5 releases after WS2-2 completes because it depends on the recast output.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge color={analysis.status === 'APPROVED' ? 'green' : 'gold'}>
              {analysis.status === 'APPROVED' ? 'WS2-1 Cleared' : 'Awaiting WS2-1 Approval'}
            </Badge>
            {onToggleCollapse && (
              <Button size="sm" variant="outline" onClick={onToggleCollapse}>
                {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {collapsed ? 'Expand Reports' : 'Collapse Reports'}
              </Button>
            )}
          </div>
        </div>

        {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        {collapsed ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {AGENTS.map((agent) => {
              const report = analysis.derivedReports?.find((item) => item.agentId === agent.id) ?? null
              return (
                <div key={agent.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">{agent.title}</p>
                  <p className="mt-2 text-xs text-slate-500">{report ? `Latest status: ${report.status}` : 'Not run yet.'}</p>
                </div>
              )
            })}
          </div>
        ) : (
          <>
        <div className="grid gap-4 md:grid-cols-3 mt-4">
          {AGENTS.map((agent) => {
            const report = analysis.derivedReports?.find((item) => item.agentId === agent.id) ?? null
            const dispatchTask = taskByAgent.get(agent.id)
            const released = !dispatchTask || dispatchTask.status === 'RELEASED'
            const disabled =
              analysis.status !== 'APPROVED' ||
              !released ||
              (agent.id === 'ws2_5_labor_v1' && !completedRecast)

            return (
              <div key={agent.id} id={SECTION_IDS[agent.id]} className="scroll-mt-24 rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{agent.title}</p>
                    <p className="text-xs text-slate-500 mt-2">{agent.description}</p>
                    <p className="text-[11px] text-slate-400 mt-2">
                      {released
                        ? agent.id === 'ws2_5_labor_v1'
                          ? 'Released after WS2-2 completed.'
                          : 'Released from WS2-1 HITL gate.'
                        : 'Not released yet.'}
                    </p>
                  </div>
                  <Badge color={report?.status === 'COMPLETE' ? 'green' : report?.status === 'FAILED' ? 'red' : 'slate'}>
                    {report?.status ?? 'Not Run'}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  className="mt-4"
                  disabled={disabled || runningAgentId === agent.id}
                  onClick={() => void runAgent(agent.id)}
                >
                  {runningAgentId === agent.id ? 'Running...' : `Run ${agent.title}`}
                </Button>
              </div>
            )
          })}
        </div>
          </>
        )}
      </Card>

      {!collapsed && AGENTS.map((agent) => {
        const report = analysis.derivedReports?.find((item) => item.agentId === agent.id) ?? null
        if (!report) return null

        const title = AGENTS.find((item) => item.id === report.agentId)?.title ?? report.agentId
        return (
          <section key={report.id} id={DETAIL_SECTION_IDS[report.agentId]} className="scroll-mt-24">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Generated {new Date(report.updatedAt).toLocaleString()}
                </p>
              </div>
              <Badge color={report.status === 'COMPLETE' ? 'green' : report.status === 'FAILED' ? 'red' : 'gold'}>
                {report.status}
              </Badge>
            </div>

            <div className="mt-4 text-sm">
              <PremiumMarkdown>{report.reportMarkdown || 'No report output available yet.'}</PremiumMarkdown>
            </div>
          </Card>
          </section>
        )
      })}
    </div>
  )
}
