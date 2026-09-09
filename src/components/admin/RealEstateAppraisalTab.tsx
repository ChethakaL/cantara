'use client'

import { useCallback, useEffect, useState } from 'react'
import { ClientDocumentUpload } from '@/components/documents/ClientDocumentUpload'
import { getAdminEmail } from '@/lib/store'
import { Button, Card } from '@/components/ui'
import { Loader2, Play } from 'lucide-react'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import InlineEditableMarkdownReport from '@/components/report-export/InlineEditableMarkdownReport'
import { generateReportHtml } from '@/lib/report-export/generate-report-html'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentProviderBar } from '@/components/admin/AgentProviderBar'
import { AgentReportHistoryBar } from '@/components/admin/AgentReportHistoryBar'
import { useAgentReportRuns } from '@/hooks/useAgentReportRuns'
import { resolveAgentModelId } from '@/lib/agent-model-provider'

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-5 border-b-2 border-stone-200 pb-3 text-2xl font-bold tracking-tight text-stone-900">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-3 mt-10 border-b border-stone-200 pb-2 text-lg font-bold tracking-tight text-stone-900">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-6 text-sm font-bold text-stone-800">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-4 text-sm leading-7 text-stone-700">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-bold text-stone-900">{children}</strong>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-5 list-disc space-y-2 pl-5 text-sm text-stone-700 marker:text-amber-500">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-stone-700 marker:text-amber-500">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-7">{children}</li>
  ),
  hr: () => <hr className="my-8 border-stone-200" />,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-4 border-l-4 border-amber-300 bg-amber-50/50 px-4 py-2 text-sm text-stone-700">{children}</blockquote>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-stone-200">
      <table className="min-w-full divide-y divide-stone-200 text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-stone-50">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-stone-500">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-t border-stone-100 px-4 py-3 align-top text-sm leading-6 text-stone-700">{children}</td>
  ),
}

function escapeExportHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function inlineExportMarkdown(value: string) {
  return escapeExportHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
}

function markdownBlockToHtml(markdown: string) {
  const lines = markdown.split('\n')
  const html: string[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line) { index += 1; continue }
    if (line.startsWith('|') && index + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1])) {
      const tableLines: string[] = []
      while (index < lines.length && lines[index].trim().startsWith('|')) tableLines.push(lines[index++])
      const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim())
      const header = cells(tableLines[0])
      const body = tableLines.slice(2).map(cells)
      html.push('<table class="report-table"><thead><tr>' + header.map(cell => '<th>' + inlineExportMarkdown(cell) + '</th>').join('') + '</tr></thead><tbody>' + body.map(row => '<tr>' + row.map(cell => '<td>' + inlineExportMarkdown(cell) + '</td>').join('') + '</tr>').join('') + '</tbody></table>')
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) items.push(lines[index++].trim().replace(/^[-*]\s+/, ''))
      html.push('<ul>' + items.map(item => '<li>' + inlineExportMarkdown(item) + '</li>').join('') + '</ul>')
      continue
    }
    if (line.startsWith('>')) {
      html.push('<blockquote>' + inlineExportMarkdown(line.replace(/^>\s*/, '')) + '</blockquote>')
      index += 1
      continue
    }
    const paragraph: string[] = [line]
    index += 1
    while (index < lines.length && lines[index].trim() && !lines[index].trim().startsWith('|') && !/^[-*]\s+/.test(lines[index].trim()) && !lines[index].trim().startsWith('>')) paragraph.push(lines[index++].trim())
    html.push('<p>' + inlineExportMarkdown(paragraph.join(' ')) + '</p>')
  }
  return html.join('')
}

function reportHtml(markdown: string, clientName: string) {
  const sections = markdown
    .split(/\n(?=##?\s)/)
    .map((block, index) => {
      const lines = block.trim().split('\n')
      const heading = (lines.shift() || '').replace(/^#+\s*/, '').trim() || (index === 0 ? 'Executive Findings' : 'Appraisal Findings')
      return { title: heading, content: markdownBlockToHtml(lines.join('\n').replace(/^-{3,}$/gm, '')) }
    })
    .filter(section => section.content.trim())

  return generateReportHtml({
    title: 'Real Estate Appraisal Report',
    subtitle: 'Property Ownership & Appraisal Review',
    clientName,
    generatedAt: new Date().toISOString(),
    sections,
    summary: 'Real estate appraisal review prepared from the client-uploaded appraisal document.',
  })
}

export default function RealEstateAppraisalTab({ clientId, clientName, readOnly = false }: { clientId: string; clientName: string; readOnly?: boolean }) {
  const [document, setDocument] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const [newAnalysis, setNewAnalysis] = useState(false)
  const { provider, setProvider } = useAgentAiProvider()
  const { historyItems, activeRun, activeId, setActiveId, reload } = useAgentReportRuns(
    '/api/real-estate-appraisal/reports',
    clientId,
  )
  const report = activeRun

  const load = (options?: { selectNewest?: boolean }) => Promise.all([
    reload(options?.selectNewest ? { selectNewest: true } : undefined),
    fetch('/api/client-documents?clientId=' + encodeURIComponent(clientId) + '&documentId=real_estate_appraisal', { cache: 'no-store' }).then(res => res.ok ? res.json() : null),
  ]).then(([, nextDocument]) => {
    setDocument(nextDocument?.document ?? null)
  }).catch(error => {
    console.error('[RealEstateAppraisalTab] load failed', error)
    setRunError(error instanceof Error ? error.message : 'Failed to load appraisal data.')
  })

  useEffect(() => {
    setLoading(true)
    setRunError('')
    void load()
      .finally(() => setLoading(false))
  }, [clientId])

  const handleSaveMarkdown = useCallback(async (markdown: string) => {
    if (!report?.id) throw new Error('No report selected to save.')
    const params = new URLSearchParams({ clientId, id: report.id })
    const res = await fetch(`/api/real-estate-appraisal/reports?${params.toString()}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown }),
    })
    if (!res.ok) {
      const payload = await res.json().catch(() => null)
      throw new Error(
        (payload && typeof payload.error === 'string' && payload.error) ||
          'Failed to save real estate appraisal report.',
      )
    }
    await reload()
  }, [clientId, report?.id, reload])

  const runAnalysis = async () => {
    if (!document?.id || running) return
    setRunning(true)
    setRunError('')
    try {
      const raw = await fetch('/api/client-documents/raw?clientId=' + encodeURIComponent(clientId) + '&documentId=real_estate_appraisal')
      if (!raw.ok) throw new Error(await raw.text())
      const blob = await raw.blob()
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
        reader.onerror = () => reject(reader.error || new Error('Could not read appraisal document'))
        reader.readAsDataURL(blob)
      })
      const response = await fetch('/api/real-estate-appraisal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          fileName: document.fileName,
          mediaType: document.mimeType || blob.type || 'application/pdf',
          base64,
          provider,
          modelId: resolveAgentModelId(provider),
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(
          (payload && typeof payload.error === 'string' && payload.error) ||
            (typeof payload === 'string' ? payload : null) ||
            `Appraisal analysis failed (${response.status})`,
        )
      }
      if (!payload?.id || !payload?.markdown) {
        throw new Error('Appraisal analysis returned no saved report. Try again.')
      }
      await load({ selectNewest: true })
      setNewAnalysis(false)
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Appraisal analysis failed.')
    } finally {
      setRunning(false)
    }
  }

  if (!loading && report?.markdown && !newAnalysis) {
    const reportTimestamps = report as { updatedAt?: string | Date }
    const updatedAtRaw = reportTimestamps.updatedAt
    const editableReport = {
      markdown: report.markdown,
      generatedAt: typeof report.createdAt === 'string'
        ? report.createdAt
        : report.createdAt
          ? new Date(report.createdAt as string | Date).toISOString()
          : undefined,
      updatedAt: typeof updatedAtRaw === 'string'
        ? updatedAtRaw
        : updatedAtRaw
          ? new Date(updatedAtRaw).toISOString()
          : undefined,
    }

    return (
      <div className="-m-6 min-h-[500px] bg-stone-50 p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-stone-900">Real Estate Appraisal Review</h2>
              <p className="mt-1 text-xs text-stone-500">Generated {report.createdAt ? new Date(report.createdAt).toLocaleString() : '—'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AgentReportHistoryBar
                runs={historyItems}
                activeId={activeId}
                onSelect={(run) => setActiveId(run.id)}
                activeProvider={report?.aiProvider}
                activeModel={report?.aiModel}
              />
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={() => setNewAnalysis(true)}>+ New Analysis</Button>
              )}
              <ExportReportButton html={reportHtml(report.markdown, clientName)} fileName={'real-estate-appraisal-' + clientName.replace(/\s+/g, '-').toLowerCase()} />
            </div>
          </div>
          <InlineEditableMarkdownReport
            report={editableReport}
            markdownComponents={markdownComponents}
            onSave={handleSaveMarkdown}
            readOnly={readOnly}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="-m-6 min-h-[500px] bg-stone-50 p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <Card className="overflow-hidden border-stone-200 bg-white p-8 shadow-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-stone-100">
              <span className="text-3xl">⌂</span>
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-stone-900">Real Estate Appraisal</h3>
            <p className="mx-auto mt-2 max-w-lg text-sm text-stone-500">
              Review the appraisal uploaded by {clientName}. Add supporting files if needed before running the analysis.
            </p>
          </div>

          <div className="space-y-4">
            {document ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                Client uploaded: <span className="font-medium">{document.fileName}</span>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                No appraisal file is attached yet. Upload one here or ask the client to upload it in Document Upload.
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {!readOnly && (
                <AgentProviderBar provider={provider} onProviderChange={setProvider} disabled={running} />
              )}
              <ClientDocumentUpload
                clientId={clientId}
                documentId="real_estate_appraisal"
                uploaderEmail={getAdminEmail()}
                currentFileName={document?.fileName ?? null}
                label={document ? 'Add another appraisal file' : 'Upload appraisal file'}
                variant="button"
                onUploaded={async () => { await load() }}
              />
              {document && !readOnly && (
                <Button size="sm" onClick={() => void runAnalysis()} disabled={running}>
                  {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  {running ? 'Analyzing…' : report ? 'Run again' : 'Run analysis'}
                </Button>
              )}
            </div>
            {runError && <p className="text-xs text-rose-600">{runError}</p>}
          </div>
        </Card>

        {loading ? <div className="mt-6 flex justify-center text-sm text-stone-400">Loading report…</div> : document ? (
          <div className="mt-6 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-5 text-center text-sm text-amber-800">
            Appraisal uploaded and ready. Click “Run analysis” to generate the report.
          </div>
        ) : null}
      </div>
    </div>
  )
}
