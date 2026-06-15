'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, FileText, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button, Card, cn } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import EditableMarkdownReportView from '@/components/report-export/EditableMarkdownReportView'
import { buildAssessmentReportHtml } from '@/lib/report-export/build-assessment-report'

type AssessmentReport = {
  workstream: string
  workstreamLabel: string
  clientName: string
  generatedAt: string
  updatedAt?: string
  markdown: string
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-5 border-b-2 border-amber-200 pb-3 text-2xl font-bold tracking-tight text-slate-900">{children}</h1>
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
    <ul className="mb-5 list-disc space-y-2 pl-5 text-sm text-slate-700 marker:text-amber-500">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-slate-700 marker:text-amber-500">{children}</ol>
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

export default function AssessmentReportTab({
  clientId,
  clientName,
  workstream,
}: {
  clientId: string
  clientName: string
  workstream: 'ws1' | 'ws2'
}) {
  const [report, setReport] = useState<AssessmentReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wsLabel = workstream === 'ws1' ? 'WS1 — Risk Mitigation' : 'WS2 — Profitability & Growth'

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/assessment-report?clientId=${encodeURIComponent(clientId)}&workstream=${workstream}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setReport(data.report)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assessment report.')
    } finally {
      setLoading(false)
    }
  }

  const generate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/assessment-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, workstream }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate assessment report.')
      setReport(data.report)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate assessment report.')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => { void load() }, [clientId, workstream])

  const html = useMemo(() =>
    report ? buildAssessmentReportHtml(report) : '',
  [report])

  if (loading) {
    return <div className="h-48 flex items-center justify-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-amber-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">Assessment Report</h2>
          <p className="text-xs text-slate-500 mt-1">{wsLabel} — Comprehensive Due Diligence Assessment</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
            <RefreshCw className={cn('w-3.5 h-3.5', generating && 'animate-spin')} />
            {report ? 'Regenerate' : 'Generate Report'}
          </Button>
          {report && (
            <ExportReportButton html={html} fileName={`${clientName} - ${wsLabel} Assessment Report.pdf`} label="Export PDF" />
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {generating && !report && (
        <Card className="p-8">
          <div className="flex items-start gap-4">
            <div className="mt-1 h-5 w-5 rounded-full border-2 border-slate-200 border-t-amber-500 animate-spin" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800">Generating assessment report</h3>
              <p className="mt-1 text-sm text-slate-500">
                Analyzing all {workstream === 'ws1' ? 'risk mitigation' : 'profitability & growth'} agent outputs to build a comprehensive assessment. This takes 30-60 seconds.
              </p>
              <div className="mt-5 space-y-3">
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
                <div className="h-20 w-full animate-pulse rounded-xl bg-slate-50" />
              </div>
            </div>
          </div>
        </Card>
      )}

      {report ? (
        <EditableMarkdownReportView
          report={report}
          accentClassName="border-amber-200 focus:ring-amber-400"
          markdownComponents={markdownComponents}
          onSave={async (markdown) => {
            const res = await fetch('/api/assessment-report', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clientId, workstream, markdown }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to save assessment report.')
            setReport(data.report)
          }}
        />
      ) : !generating ? (
        <Card className="p-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-amber-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Assessment Report</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
            Generate a comprehensive due diligence assessment that synthesizes findings from all {workstream === 'ws1' ? 'risk mitigation' : 'profitability & growth'} agents into a single executive report.
          </p>
          <Button onClick={generate} disabled={generating}>
            Generate Assessment Report
          </Button>
        </Card>
      ) : null}
    </div>
  )
}
