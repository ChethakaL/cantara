'use client'

import { useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge, Button, Card, Modal } from '@/components/ui'
import { logWs2ClientEvent, logWs2Error, logWs2Response } from '@/lib/ttm-agent/browser-debug'
import type { TtmAnalysisView } from '@/lib/ttm-agent/types'
import { Ws2WorkbookView } from './Ws2WorkbookView'
import type { WorkbookChange, WorkbookOverrideSnapshot } from '@/lib/ttm-agent/workbook-overrides'

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
  const [uploadingWorkbook, setUploadingWorkbook] = useState(false)
  const [pendingWorkbookChanges, setPendingWorkbookChanges] = useState<WorkbookChange[]>([])
  const [pendingSnapshot, setPendingSnapshot] = useState<WorkbookOverrideSnapshot | null>(null)
  const [applyingWorkbookChanges, setApplyingWorkbookChanges] = useState(false)
  const [recentWorkbookChanges, setRecentWorkbookChanges] = useState<WorkbookChange[]>([])
  const workbookInputRef = useRef<HTMLInputElement | null>(null)

  const report = analysis.derivedReports?.find((item) => item.agentId === 'ws2_10_report_generator_v1') ?? null
  const approvedRecast = analysis.recastAnalyses?.find((recast) => recast.status === 'APPROVED') ?? null
  const latestRecast = analysis.recastAnalyses?.[0] ?? null // Most recent run regardless of status
  const displayRecast = latestRecast ?? approvedRecast // Show latest data in workbook
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

  const handleWorkbookPicked = async (file: File) => {
    setError(null)
    setUploadingWorkbook(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/ttm-agent/reports/${analysis.id}/workbook-overrides`, {
        method: 'POST',
        body: formData,
      })
      await logWs2Response('WS2 workbook override preview', res)
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Failed to parse uploaded workbook')
      }
      const data = (await res.json()) as { changes: WorkbookChange[]; snapshot: WorkbookOverrideSnapshot }
      setPendingWorkbookChanges(data.changes)
      setPendingSnapshot(data.snapshot)
    } catch (uploadError) {
      logWs2Error('WS2 workbook override preview', uploadError, { analysisId: analysis.id })
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to parse uploaded workbook')
      setPendingWorkbookChanges([])
      setPendingSnapshot(null)
    } finally {
      setUploadingWorkbook(false)
      if (workbookInputRef.current) workbookInputRef.current.value = ''
    }
  }

  const applyWorkbookChanges = async () => {
    if (!pendingSnapshot) return
    setApplyingWorkbookChanges(true)
    setError(null)
    try {
      const appliedChanges = [...pendingWorkbookChanges]
      const res = await fetch(`/api/ttm-agent/reports/${analysis.id}/workbook-overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot: pendingSnapshot }),
      })
      await logWs2Response('WS2 workbook override apply', res)
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Failed to apply workbook changes')
      }
      onUpdated((await res.json()) as TtmAnalysisView)
      setRecentWorkbookChanges(appliedChanges)
      setPendingWorkbookChanges([])
      setPendingSnapshot(null)
      window.setTimeout(() => {
        document.getElementById('ws210-pl-summary')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
      window.setTimeout(() => {
        setRecentWorkbookChanges([])
      }, 12000)
    } catch (applyError) {
      logWs2Error('WS2 workbook override apply', applyError, { analysisId: analysis.id })
      setError(applyError instanceof Error ? applyError.message : 'Failed to apply workbook changes')
    } finally {
      setApplyingWorkbookChanges(false)
    }
  }

  const controls = (
    <Card className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge color="gold">Internal Only</Badge>
            {report?.status === 'COMPLETE' && <Badge color="green">Report Ready</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {onToggleCollapse && (
              <Button size="sm" variant="outline" onClick={onToggleCollapse}>
                {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {collapsed ? 'Expand' : 'Collapse'}
              </Button>
            )}
            <Button size="sm" onClick={() => void runReport()} disabled={disabled || running}>
              {running ? 'Generating...' : report ? 'Refresh Report' : 'Generate Report'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => workbookInputRef.current?.click()} disabled={!report || uploadingWorkbook}>
              {uploadingWorkbook ? 'Reading XLSX...' : 'Import Edited XLSX'}
            </Button>
            <input
              ref={workbookInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleWorkbookPicked(file)
              }}
            />
          </div>
        </div>

        {error && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      </Card>
  )

  return (
    <div className="space-y-4">
      {!collapsed && displayRecast && (
        <Ws2WorkbookView
          analysis={analysis}
          recast={displayRecast}
          clientName={clientName}
          onExportXlsx={onExportXlsx}
        />
      )}

      {controls}
      <Modal
        open={Boolean(pendingSnapshot)}
        onClose={() => {
          if (applyingWorkbookChanges) return
          setPendingWorkbookChanges([])
          setPendingSnapshot(null)
        }}
        title="Confirm XLSX Changes"
        sizeClassName="max-w-4xl"
      >
        {pendingWorkbookChanges.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">No meaningful changes were detected in the uploaded workbook.</p>
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setPendingSnapshot(null)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Detected <span className="font-semibold">{pendingWorkbookChanges.length}</span> edited values.
              Approving will save them and update the baseline web report.
            </p>
            <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Section</th>
                    <th className="px-3 py-2">Label</th>
                    <th className="px-3 py-2">Field</th>
                    <th className="px-3 py-2 text-right">Before</th>
                    <th className="px-3 py-2 text-right">After</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingWorkbookChanges.map((change, index) => (
                    <tr key={`${change.section}-${change.label}-${change.field}-${index}`} className="border-t border-slate-100">
                      <td className="px-3 py-2">{change.section}</td>
                      <td className="px-3 py-2">{change.label}</td>
                      <td className="px-3 py-2">{change.field}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{change.before}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-900">{change.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setPendingSnapshot(null)} disabled={applyingWorkbookChanges}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void applyWorkbookChanges()} disabled={applyingWorkbookChanges}>
                {applyingWorkbookChanges ? 'Applying...' : 'Apply to Database'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
