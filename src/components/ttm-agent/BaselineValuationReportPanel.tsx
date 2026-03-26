'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { PremiumMarkdown } from '@/components/ttm-agent/PremiumMarkdown'
import { Badge, Button, Card } from '@/components/ui'
import { logWs2ClientEvent, logWs2Error, logWs2Response } from '@/lib/ttm-agent/browser-debug'
import type { TtmAnalysisView } from '@/lib/ttm-agent/types'
import { ValuationDashboard } from './ValuationDashboard'

function formatCurrency(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : 'Not available'
}

function formatPct(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}%` : 'Not available'
}

export function BaselineValuationReportPanel({
  clientName,
  analysis,
  onUpdated,
  onExportXlsx,
  hideWorkflowChrome = false,
  collapsed = false,
  onToggleCollapse,
}: {
  clientName: string
  analysis: TtmAnalysisView
  onUpdated: (analysis: TtmAnalysisView) => void
  onExportXlsx?: () => void
  hideWorkflowChrome?: boolean
  collapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRawOutput, setShowRawOutput] = useState(false)

  const report = analysis.derivedReports?.find((item) => item.agentId === 'ws2_10_report_generator_v1') ?? null
  const approvedRecast = analysis.recastAnalyses?.find((recast) => recast.status === 'APPROVED') ?? null
  const sourceReportsComplete = ['ws2_3_rev_vertical_v1', 'ws2_4_benchmark_v1', 'ws2_5_labor_v1'].every((agentId) =>
    (analysis.derivedReports ?? []).some((item) => item.agentId === agentId && item.status === 'COMPLETE'),
  )
  const dispatchTask = analysis.dispatchTasks.find((task) => task.agentId === 'ws2_10_report_generator_v1')
  const released = !dispatchTask || dispatchTask.status === 'RELEASED'
  const disabled = analysis.status !== 'APPROVED' || !released || !approvedRecast || !sourceReportsComplete
  const stagePreview = !report
  const sourceStatuses = [
    { label: 'WS2-2 EBITDA', status: approvedRecast ? 'Approved' : analysis.recastAnalyses?.[0]?.status ?? 'Not run' },
    { label: 'WS2-3 Revenue', status: (analysis.derivedReports ?? []).find((item) => item.agentId === 'ws2_3_rev_vertical_v1')?.status ?? 'Not run' },
    { label: 'WS2-4 Benchmarks', status: (analysis.derivedReports ?? []).find((item) => item.agentId === 'ws2_4_benchmark_v1')?.status ?? 'Not run' },
    { label: 'WS2-5 Labor', status: (analysis.derivedReports ?? []).find((item) => item.agentId === 'ws2_5_labor_v1')?.status ?? 'Not run' },
  ]

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

  const controls = (
    <Card className="p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h4 className="text-sm font-semibold text-slate-800">Baseline Valuation Report</h4>
            <p className="text-xs text-slate-400 mt-1">
              Report-first UI assembled after approved WS2-2 and completed WS2-3/WS2-4/WS2-5.
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
  )

  const preview = !collapsed && analysis.status === 'APPROVED' && stagePreview ? (
    <Card className="overflow-hidden border-slate-200">
      <div className="border-b border-slate-200 bg-slate-900 px-6 py-6 text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">Cantara Pet Advisors · baseline valuation report</p>
            <h3 className="mt-3 text-3xl font-semibold">{clientName}</h3>
            <p className="mt-2 text-sm text-slate-300">The valuation report is being assembled in stages. WS2-1 is approved, and WS2-2 / WS2-3 / WS2-4 / WS2-5 feed the final baseline report.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge color="green">WS2-1 Approved</Badge>
            <Badge color="gold">Internal Only</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-0 border-b border-slate-200 md:grid-cols-4">
        <div className="border-b border-slate-200 px-5 py-4 md:border-b-0 md:border-r">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">TTM revenue</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{formatCurrency(analysis.ttmSummary?.totalRevenue)}</p>
        </div>
        <div className="border-b border-slate-200 px-5 py-4 md:border-b-0 md:border-r">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Gross margin</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{formatPct(analysis.ttmSummary?.grossMarginPct)}</p>
        </div>
        <div className="border-b border-slate-200 px-5 py-4 md:border-b-0 md:border-r">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">4-wall EBITDA</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{formatCurrency(analysis.ttmSummary?.ebitdaPreRecast)}</p>
          <p className="mt-1 text-xs text-slate-500">Pre-recast from WS2-1</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Baseline stage</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{approvedRecast ? 'EBITDA approved' : 'Awaiting EBITDA approval'}</p>
          <p className="mt-1 text-xs text-slate-500">
            {approvedRecast
              ? 'Derived reports and final baseline output are next.'
              : 'WS2-2 needs to complete before valuation ranges can be finalized.'}
          </p>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-slate-200 p-5">
            <h4 className="text-sm font-semibold text-slate-800">What is ready now</h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The report already has the approved WS2-1 operating picture. The valuation range and full report body appear after WS2-2 EBITDA is approved and the downstream report sections complete.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5">
            <h4 className="text-sm font-semibold text-slate-800">Build progress</h4>
            <div className="mt-4 space-y-3">
              {sourceStatuses.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="text-sm font-medium text-slate-800">{item.label}</span>
                  <Badge color={item.status === 'Approved' || item.status === 'COMPLETE' ? 'green' : item.status === 'RUNNING' ? 'blue' : item.status === 'FAILED' ? 'red' : 'gold'}>
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  ) : null

  return (
    <div className="space-y-4">
      {!collapsed && report && approvedRecast ? (
        <>
          <ValuationDashboard
            analysis={analysis}
            recast={approvedRecast}
            clientName={clientName}
            report={report}
            onExportXlsx={onExportXlsx}
          />

          {!hideWorkflowChrome && (
            <>
              {controls}

              <Card className="p-5 bg-slate-50 border-slate-200">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">Raw Narrative</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Hidden by default so the UI leads with the valuation, not the markdown output.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setShowRawOutput((current) => !current)}>
                    {showRawOutput ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    {showRawOutput ? 'Hide Narrative' : 'Show Narrative'}
                  </Button>
                </div>

                {showRawOutput && (
                  <div className="mt-4 text-sm">
                    <PremiumMarkdown>{report.reportMarkdown || 'No report output available yet.'}</PremiumMarkdown>
                  </div>
                )}
              </Card>
            </>
          )}
        </>
      ) : (
        <>
          {preview}
          {controls}
        </>
      )}
    </div>
  )
}
