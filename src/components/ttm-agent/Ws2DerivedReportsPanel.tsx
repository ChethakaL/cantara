'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Badge, Button, Card } from '@/components/ui'
import { logWs2ClientEvent, logWs2Error, logWs2PreparedDocuments, logWs2Response } from '@/lib/ttm-agent/browser-debug'
import { prepareWs2DocumentFromServer } from '@/lib/ttm-agent/browser-documents'
import type { DocumentStatus } from '@/lib/store'
import type { TtmAnalysisView, Ws2DerivedAgentId } from '@/lib/ttm-agent/types'

const AGENTS: Array<{ id: Ws2DerivedAgentId; title: string; description: string }> = [
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

export function Ws2DerivedReportsPanel({
  analysis,
  clientId,
  documentStatuses,
  onUpdated,
}: {
  analysis: TtmAnalysisView
  clientId: string
  documentStatuses: Record<string, DocumentStatus>
  onUpdated: (analysis: TtmAnalysisView) => void
}) {
  const [runningAgentId, setRunningAgentId] = useState<Ws2DerivedAgentId | null>(null)
  const [error, setError] = useState<string | null>(null)

  const approvedRecast = analysis.recastAnalyses?.find((recast) => recast.status === 'APPROVED') ?? null
  const taskByAgent = new Map(analysis.dispatchTasks.map((task) => [task.agentId, task]))

  const runAgent = async (agentId: Ws2DerivedAgentId) => {
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
            <h4 className="text-sm font-semibold text-slate-800">WS2-3 / WS2-4 / WS2-5</h4>
            <p className="text-xs text-slate-400 mt-1">
              WS2-3 and WS2-4 release after Craig approves WS2-1. WS2-5 releases only after WS2-2 is approved because it depends on the recast output.
            </p>
          </div>
          <Badge color={analysis.status === 'APPROVED' ? 'green' : 'gold'}>
            {analysis.status === 'APPROVED' ? 'WS2-1 Cleared' : 'Awaiting WS2-1 Approval'}
          </Badge>
        </div>

        {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="grid gap-4 md:grid-cols-3 mt-4">
          {AGENTS.map((agent) => {
            const report = analysis.derivedReports?.find((item) => item.agentId === agent.id) ?? null
            const dispatchTask = taskByAgent.get(agent.id)
            const released = !dispatchTask || dispatchTask.status === 'RELEASED'
            const disabled = analysis.status !== 'APPROVED' || !released || (agent.id === 'ws2_5_labor_v1' && !approvedRecast)

            return (
              <div key={agent.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{agent.title}</p>
                    <p className="text-xs text-slate-500 mt-2">{agent.description}</p>
                    <p className="text-[11px] text-slate-400 mt-2">
                      {released
                        ? agent.id === 'ws2_5_labor_v1'
                          ? 'Released after approved WS2-2 recast.'
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
      </Card>

      {(analysis.derivedReports ?? []).map((report) => {
        const title = AGENTS.find((agent) => agent.id === report.agentId)?.title ?? report.agentId
        return (
          <Card key={report.id} className="p-5">
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

            <div className="prose prose-slate max-w-none mt-4 text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.reportMarkdown || 'No report output available yet.'}</ReactMarkdown>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
