'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Badge, Button, Card } from '@/components/ui'
import { logWs2ClientEvent, logWs2Error, logWs2Response } from '@/lib/ttm-agent/browser-debug'
import type { TtmAnalysisView } from '@/lib/ttm-agent/types'

export function BaselineValuationReportPanel({
  analysis,
  onUpdated,
  collapsed = false,
  onToggleCollapse,
}: {
  analysis: TtmAnalysisView
  onUpdated: (analysis: TtmAnalysisView) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const report = analysis.derivedReports?.find((item) => item.agentId === 'ws2_10_report_generator_v1') ?? null
  const approvedRecast = analysis.recastAnalyses?.find((recast) => recast.status === 'APPROVED') ?? null
  const sourceReportsComplete = ['ws2_3_rev_vertical_v1', 'ws2_4_benchmark_v1', 'ws2_5_labor_v1'].every((agentId) =>
    (analysis.derivedReports ?? []).some((item) => item.agentId === agentId && item.status === 'COMPLETE'),
  )
  const dispatchTask = analysis.dispatchTasks.find((task) => task.agentId === 'ws2_10_report_generator_v1')
  const released = !dispatchTask || dispatchTask.status === 'RELEASED'
  const disabled = analysis.status !== 'APPROVED' || !released || !approvedRecast || !sourceReportsComplete

  const runReport = async () => {
    setRunning(true)
    setError(null)
    try {
      logWs2ClientEvent('WS2-10 run request', {
        analysisId: analysis.id,
        agentId: 'ws2_10_report_generator_v1',
      })

      const res = await fetch('/api/ttm-agent/derived', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysisId: analysis.id,
          agentId: 'ws2_10_report_generator_v1',
        }),
      })
      await logWs2Response('WS2-10 response', res)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Failed to run baseline valuation report')
      }

      onUpdated(await res.json())
    } catch (runError) {
      logWs2Error('WS2-10 run', runError, {
        analysisId: analysis.id,
      })
      setError(runError instanceof Error ? runError.message : 'Failed to run baseline valuation report')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Baseline Valuation Report</h4>
            <p className="text-xs text-slate-400 mt-1">
              Separate internal valuation report assembled after approved WS2-2 and completed WS2-3/WS2-4/WS2-5.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge color="gold">Internal Only</Badge>
            <Badge color={report?.status === 'COMPLETE' ? 'green' : released ? 'blue' : 'gold'}>
              {report?.status ?? (released ? 'Ready to Run' : 'Blocked')}
            </Badge>
            {onToggleCollapse && (
              <Button size="sm" variant="outline" onClick={onToggleCollapse}>
                {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {collapsed ? 'Expand Report' : 'Collapse Report'}
              </Button>
            )}
            <Button size="sm" onClick={() => void runReport()} disabled={disabled || running}>
              {running ? 'Running...' : report ? 'Refresh Report' : 'Run Report'}
            </Button>
          </div>
        </div>

        {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        {collapsed ? (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Status</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{report?.status ?? 'Not Run'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">WS2-2 Approved</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{approvedRecast ? 'Yes' : 'No'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">WS2-3/4/5 Complete</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{sourceReportsComplete ? 'Yes' : 'No'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Release Gate</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{released ? 'Released' : 'Blocked'}</p>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Status</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{report?.status ?? 'Not Run'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">WS2-2 Approved</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{approvedRecast ? 'Yes' : 'No'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">WS2-3/4/5 Complete</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{sourceReportsComplete ? 'Yes' : 'No'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Release Gate</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{released ? 'Released' : 'Blocked'}</p>
            </div>
          </div>
        )}
      </Card>

      {!collapsed && report && (
        <section id="ws210-report-detail" className="scroll-mt-24">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Baseline Valuation Report</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Generated {new Date(report.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge color="gold">Internal Only</Badge>
                <Badge color={report.status === 'COMPLETE' ? 'green' : report.status === 'FAILED' ? 'red' : 'gold'}>
                  {report.status}
                </Badge>
              </div>
            </div>

            <div className="prose prose-slate max-w-none mt-4 text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.reportMarkdown || 'No report output available yet.'}</ReactMarkdown>
            </div>
          </Card>
        </section>
      )}
    </div>
  )
}
