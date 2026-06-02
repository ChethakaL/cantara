'use client'

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, FileText, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button, Card, cn } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { buildAgentOverviewReportHtml, type AgentOverviewReport } from '@/lib/report-export/build-agent-overview-report'

type OverviewState = {
  workstreamLabel: string
  complete: boolean
  incompleteAgents: string[]
  agents: AgentOverviewReport['agents']
  report: AgentOverviewReport | null
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-5 border-b border-slate-200 pb-3 text-xl font-bold tracking-tight text-slate-900">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-3 mt-8 text-base font-bold tracking-tight text-slate-900">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-800">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-4 text-sm leading-7 text-slate-700">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
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
  hr: () => <hr className="my-7 border-slate-200" />,
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
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-800">{children}</code>
  ),
}

export default function AgentOverviewTab({
  clientId,
  clientName,
  adminName,
}: {
  clientId: string
  clientName: string
  adminName: string
}) {
  const [state, setState] = useState<OverviewState | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/agent-overview?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setState(data)
      if (data.complete && !data.report) {
        setLoading(false)
        await generate()
        return
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agent overview.')
    } finally {
      setLoading(false)
    }
  }

  const generate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/agent-overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, generatedBy: adminName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate overview.')
      setState(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate overview.')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    void load()
  }, [clientId])

  const html = useMemo(() => state?.report ? buildAgentOverviewReportHtml(state.report) : '', [state?.report])

  if (loading) {
    return <div className="h-48 flex items-center justify-center"><div className="w-6 h-6 border-2 border-slate-200 border-t-amber-500 rounded-full animate-spin" /></div>
  }

  if (!state?.complete) {
    return (
      <Card className="p-6 border-amber-200 bg-amber-50">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-slate-800">Agent Overview Locked</h3>
            <p className="text-sm text-slate-600 mt-1">All agents in this workstream must be completed before generating overview.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(state?.incompleteAgents ?? []).map(agent => (
                <span key={agent} className="px-2.5 py-1 rounded-md bg-white border border-amber-200 text-xs font-medium text-slate-700">{agent}</span>
              ))}
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">Agent Overview</h2>
          <p className="text-xs text-slate-500 mt-1">{state.workstreamLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
            <RefreshCw className={cn('w-3.5 h-3.5', generating && 'animate-spin')} />
            {state.report ? 'Rerun' : 'Generate'}
          </Button>
          {state.report && (
            <ExportReportButton html={html} fileName={`${clientName} - Agent Overview.pdf`} label="Export PDF" />
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {generating && !state.report && (
        <Card className="p-8">
          <div className="flex items-start gap-4">
            <div className="mt-1 h-5 w-5 rounded-full border-2 border-slate-200 border-t-amber-500 animate-spin" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800">Generating agent overview</h3>
              <p className="mt-1 text-sm text-slate-500">Preparing the workstream summary from completed agent outputs.</p>
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

      {state.report ? (
        <Card className="p-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
            <FileText className="w-3.5 h-3.5" />
            Generated {new Date(state.report.generatedAt).toLocaleString()}
          </div>
          <div className="max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {state.report.markdown}
            </ReactMarkdown>
          </div>
        </Card>
      ) : !generating ? (
        <Card className="p-6 text-sm text-slate-500">No overview generated yet.</Card>
      ) : null}
    </div>
  )
}
