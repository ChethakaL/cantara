'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, FileText, MapPin } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button, Card, cn } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { buildImprovementRoadmapHtml } from '@/lib/report-export/build-improvement-roadmap-report'

type RoadmapReport = {
  workstream: string
  workstreamLabel: string
  clientName: string
  generatedAt: string
  markdown: string
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
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-t border-slate-100 px-4 py-3 align-top text-sm leading-6 text-slate-700">{children}</td>
  ),
}

export default function ImprovementRoadmapTab({
  clientId,
  clientName,
  workstream,
}: {
  clientId: string
  clientName: string
  workstream: 'ws1' | 'ws2'
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
      setError(err instanceof Error ? err.message : 'Failed to load improvement roadmap.')
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
      if (!res.ok) throw new Error(data.error || 'Failed to generate improvement roadmap.')
      setReport(data.report)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate improvement roadmap.')
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">Improvement Roadmap</h2>
          <p className="text-xs text-slate-500 mt-1">{wsLabel} — Seller Sale-Readiness Roadmap</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
            <RefreshCw className={cn('w-3.5 h-3.5', generating && 'animate-spin')} />
            {report ? 'Regenerate' : 'Generate Roadmap'}
          </Button>
          {report && (
            <ExportReportButton html={html} fileName={`${clientName} - ${wsLabel} Improvement Roadmap.pdf`} label="Export PDF" />
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {generating && !report && (
        <Card className="p-8">
          <div className="flex items-start gap-4">
            <div className="mt-1 h-5 w-5 rounded-full border-2 border-slate-200 border-t-emerald-500 animate-spin" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800">Building improvement roadmap</h3>
              <p className="mt-1 text-sm text-slate-500">
                Analyzing all agent findings to create a prioritized, actionable improvement plan for the seller. This takes 30-60 seconds.
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
        <Card className="p-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 mb-6">
            <MapPin className="w-3.5 h-3.5" />
            Generated {new Date(report.generatedAt).toLocaleString()}
          </div>
          <div className="max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {report.markdown}
            </ReactMarkdown>
          </div>
        </Card>
      ) : !generating ? (
        <Card className="p-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <MapPin className="w-7 h-7 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Improvement Roadmap</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Generate a detailed, prioritized improvement roadmap for the seller based on all {workstream === 'ws1' ? 'risk mitigation' : 'profitability & growth'} agent findings. Tells the seller exactly what to fix to be sale-ready.
          </p>
          <Button onClick={generate} disabled={generating}>
            Generate Improvement Roadmap
          </Button>
        </Card>
      ) : null}
    </div>
  )
}
