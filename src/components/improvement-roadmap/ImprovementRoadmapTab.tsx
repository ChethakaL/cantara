'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, MapPin, CheckCircle2, Circle, ClipboardCheck } from 'lucide-react'
import { Button, Card, cn } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import InlineEditableMarkdownReport from '@/components/report-export/InlineEditableMarkdownReport'
import { buildImprovementRoadmapHtml } from '@/lib/report-export/build-improvement-roadmap-report'
import { getStatusBadgeKind, isStatusCell } from '@/lib/report-export/status-cell'

type RoadmapReport = {
  workstream: string
  workstreamLabel: string
  clientName: string
  generatedAt: string
  updatedAt?: string
  markdown: string
  checklist?: SaleReadinessChecklistItem[]
}

type SaleReadinessChecklistItem = {
  id: string
  category: string
  item: string
  status: string
  actionNeeded: string
  advisorApproved: boolean
  approvedAt?: string | null
  clientCompleted: boolean
  clientCompletedAt?: string | null
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

function ChecklistApprovalPanel({
  clientId,
  workstream,
  items,
  onUpdated,
}: {
  clientId: string
  workstream: 'ws1' | 'ws2'
  items: SaleReadinessChecklistItem[]
  onUpdated: (items: SaleReadinessChecklistItem[]) => void
}) {
  const [updating, setUpdating] = useState<string | null>(null)
  const approvedCount = items.filter(item => item.advisorApproved).length

  const toggleApproved = async (item: SaleReadinessChecklistItem) => {
    setUpdating(item.id)
    try {
      const res = await fetch('/api/sale-readiness-checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          workstream,
          itemId: item.id,
          advisorApproved: !item.advisorApproved,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update checklist item.')
      onUpdated(data.checklist?.items ?? [])
    } finally {
      setUpdating(null)
    }
  }

  const approveAll = async () => {
    setUpdating('all')
    try {
      const res = await fetch('/api/sale-readiness-checklist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          workstream,
          itemId: 'all',
          advisorApproved: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to approve all checklist items.')
      onUpdated(data.checklist?.items ?? [])
    } finally {
      setUpdating(null)
    }
  }

  if (!items.length) return null

  return (
    <Card className="overflow-hidden border-emerald-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-emerald-50/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Client Checklist Release</p>
            <p className="text-[11px] text-slate-500">Approve rows Craig wants visible in the client portal checklist.</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {approvedCount < items.length && (
            <button
              type="button"
              disabled={updating !== null}
              onClick={approveAll}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
            >
              {updating === 'all' ? 'Approving...' : 'Approve All'}
            </button>
          )}
          <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-semibold text-emerald-700">
            {approvedCount}/{items.length} approved
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Visible</th>
              <th className="px-4 py-2 text-left font-semibold">Category</th>
              <th className="px-4 py-2 text-left font-semibold">Item</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(item => (
              <tr key={item.id} className="align-top">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={updating === item.id}
                    onClick={() => void toggleApproved(item)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      item.advisorApproved
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {item.advisorApproved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    {item.advisorApproved ? 'Approved' : 'Approve'}
                  </button>
                </td>
                <td className="px-4 py-3 text-xs font-semibold text-slate-600">{item.category}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{item.item}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{item.actionNeeded}</p>
                </td>
                <td className="px-4 py-3"><StatusBadge text={item.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-5 border-b-2 border-emerald-200 pb-3 text-2xl font-bold tracking-tight text-slate-900">{children}</h1>
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
    <ul className="mb-5 list-disc space-y-2 pl-5 text-sm text-slate-700 marker:text-emerald-500">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-slate-700 marker:text-emerald-500">{children}</ol>
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
  th: ({ children }: { children?: React.ReactNode }) => {
    const text = String(children ?? '')
    if (text.includes('🔴')) {
      return <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-rose-600 bg-rose-50/50">{children}</th>
    }
    if (text.includes('🟡')) {
      return <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50/50">{children}</th>
    }
    if (text.includes('🟢')) {
      return <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wide text-emerald-600 bg-emerald-50/50">{children}</th>
    }
    return <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">{children}</th>
  },
  td: ({ children }: { children?: React.ReactNode }) => {
    const text = String(children ?? '')
    if (isStatusCell(text)) {
      return <td className="border-t border-slate-100 px-4 py-3 align-top"><StatusBadge text={text} /></td>
    }
    if (text.trim() === '☐' || text.trim() === '☑') {
      return (
        <td className="border-t border-slate-100 px-4 py-3 align-top text-center">
          {text.trim() === '☑'
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
            : <Circle className="w-4 h-4 text-slate-300 inline" />
          }
        </td>
      )
    }
    return <td className="border-t border-slate-100 px-4 py-3 align-top text-sm leading-6 text-slate-700">{children}</td>
  },
}

export default function ImprovementRoadmapTab({
  clientId,
  clientName,
  workstream,
  readOnly = false,
}: {
  clientId: string
  clientName: string
  workstream: 'ws1' | 'ws2'
  readOnly?: boolean
}) {
  const [report, setReport] = useState<RoadmapReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wsLabel = workstream === 'ws1' ? 'WS1 — Risk Mitigation' : 'WS2 — Profitability & Growth'

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/improvement-roadmap?clientId=${encodeURIComponent(clientId)}&workstream=${workstream}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setReport(data.report)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roadmap.')
    } finally {
      setLoading(false)
    }
  }

  const generate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/improvement-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, workstream }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate roadmap.')
      setReport(data.report)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate roadmap.')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => { void load() }, [clientId, workstream])

  const html = useMemo(() =>
    report ? buildImprovementRoadmapHtml(report) : '',
  [report])

  if (loading) {
    return <div className="h-48 flex items-center justify-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">Sales Readiness Roadmap</h2>
          <p className="text-xs text-slate-500 mt-1">{wsLabel} — Seller-Facing Sale Readiness Plan</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
              <RefreshCw className={cn('w-3.5 h-3.5', generating && 'animate-spin')} />
              {report ? 'Regenerate' : 'Generate Roadmap'}
            </Button>
          )}
          {report && (
            <ExportReportButton html={html} fileName={`${clientName} - ${wsLabel} Sales Readiness Roadmap.pdf`} label="Export PDF" />
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {generating && !report && (
        <Card className="p-8">
          <div className="flex items-start gap-4">
            <div className="mt-1 h-5 w-5 rounded-full border-2 border-slate-200 border-t-emerald-500 animate-spin" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800">Building Sales Readiness Roadmap</h3>
              <p className="mt-1 text-sm text-slate-500">
                Analyzing all agent findings to create a prioritized, actionable improvement plan with sale readiness indicators. This takes 30-60 seconds.
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
        <>
          {!readOnly && (
            <ChecklistApprovalPanel
              clientId={clientId}
              workstream={workstream}
              items={report.checklist ?? []}
              onUpdated={(items) => setReport(current => current ? { ...current, checklist: items } : current)}
            />
          )}
          <InlineEditableMarkdownReport
            report={report}
            markdownComponents={markdownComponents}
            readOnly={readOnly}
            onSave={async (markdown) => {
              const res = await fetch('/api/improvement-roadmap', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, workstream, markdown }),
              })
              const data = await res.json()
              if (!res.ok) throw new Error(data.error || 'Failed to save roadmap.')
              setReport(data.report)
            }}
          />
        </>
      ) : !generating ? (
        <Card className="p-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <MapPin className="w-7 h-7 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Sales Readiness Roadmap</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Generate a seller-facing assessment and improvement roadmap based on all {workstream === 'ws1' ? 'risk mitigation' : 'profitability & growth'} agent findings. Shows the seller exactly what to do to become sale-ready.
          </p>
          <Button onClick={generate} disabled={generating}>
            Generate Roadmap
          </Button>
        </Card>
      ) : null}
    </div>
  )
}
