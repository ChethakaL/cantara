'use client'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import type { AgentTabReadOnlyProps } from '@/types/agent-tab'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, Button, cn } from '@/components/ui'
import { useWS110Analysis, type UploadedDoc } from '@/hooks/useWS110Analysis'
import { parseWS110Markdown } from '@/lib/ws1-10/parser'
import type { WS110Persistence, WS110Flag } from '@/types/ws1-10-types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import InlineEditableMarkdownReport from '@/components/report-export/InlineEditableMarkdownReport'
import { AdvisorActions } from '@/components/client-portal/AgentClientPortalFrame'
import { buildLegalEntitySearchReportHtml } from '@/lib/report-export/build-legal-entity-search-report'
import { Upload, FileText, X, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentProviderBar } from '@/components/admin/AgentProviderBar'
import { AgentReportHistoryBar } from '@/components/admin/AgentReportHistoryBar'
import { useAgentReportRuns } from '@/hooks/useAgentReportRuns'

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

// ── Document Uploader ───────────────────────────────────────────────────────

function DocumentUploader({
  onDocumentsReady,
  onAnalyze,
  isLoading,
  providerBar,
}: {
  onDocumentsReady: (docs: UploadedDoc[]) => void
  onAnalyze: () => void
  isLoading: boolean
  providerBar?: React.ReactNode
}) {
  const [files, setFiles] = useState<UploadedDoc[]>([])

  const handleFiles = useCallback(async (fileList: FileList) => {
    const newDocs: UploadedDoc[] = []
    for (const file of Array.from(fileList)) {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      newDocs.push({
        name: file.name,
        base64,
        mediaType: file.type || 'application/octet-stream',
        slotKey: 'legal_docs',
        sizeBytes: file.size,
      })
    }
    const updated = [...files, ...newDocs]
    setFiles(updated)
    onDocumentsReady(updated)
  }, [files, onDocumentsReady])

  const removeFile = (name: string) => {
    const updated = files.filter(f => f.name !== name)
    setFiles(updated)
    onDocumentsReady(updated)
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center">
          <FileText className="w-8 h-8 text-stone-400" />
        </div>
        <h3 className="text-xl font-semibold text-stone-900 tracking-tight">Legal Reports & Entity Search</h3>
        <p className="text-stone-500 text-sm max-w-lg mx-auto">
          Upload corporate documents, Secretary of State filings, UCC search results, certificates of good standing,
          trademark registrations, and registered agent confirmations for AI-powered legal due diligence analysis.
        </p>
      </div>

      <label className="block border-2 border-dashed border-stone-300 rounded-xl p-8 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all">
        <Upload className="w-6 h-6 text-stone-400 mx-auto mb-2" />
        <span className="text-sm text-stone-600 font-medium">Drop files or click to upload</span>
        <span className="block text-xs text-stone-400 mt-1">PDF, DOCX, XLSX, PNG, JPG</span>
        <input
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
          className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
      </label>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(f => (
            <div key={f.name} className="flex items-center gap-3 px-4 py-2.5 bg-stone-50 rounded-lg border border-stone-200">
              <FileText className="w-4 h-4 text-stone-400 flex-shrink-0" />
              <span className="text-sm text-stone-700 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-stone-400">{((f.sizeBytes ?? 0) / 1024).toFixed(0)} KB</span>
              <button onClick={() => removeFile(f.name)} className="text-stone-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {providerBar}
          <Button onClick={onAnalyze} disabled={isLoading} className="w-full mt-4">
            {isLoading ? 'Analyzing...' : `Analyze ${files.length} Document${files.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Flag Review Panel ───────────────────────────────────────────────────────

function FlagReviewPanel({
  flags,
  onConfirm,
  onNA,
  readOnly = false,
}: {
  flags: WS110Flag[]
  onConfirm: (id: string) => void
  onNA: (id: string) => void
  readOnly?: boolean
}) {
  const severityColor = (s: string) => {
    if (s === 'deal-risk') return 'bg-red-50 border-red-200 text-red-700'
    if (s === 'negotiation') return 'bg-amber-50 border-amber-200 text-amber-700'
    return 'bg-emerald-50 border-emerald-200 text-emerald-700'
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Flag Review</h4>
      {flags.length === 0 && <p className="text-sm text-stone-400">No flags identified.</p>}
      {flags.map(flag => (
        <div key={flag.id} className={cn('p-4 rounded-xl border', severityColor(flag.severity))}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{flag.domain}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">{flag.severity}</span>
              </div>
              <p className="text-sm font-medium">{flag.title}</p>
              {flag.sourceRef && <p className="text-xs opacity-60 mt-1">Source: {flag.sourceRef}</p>}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {!readOnly && flag.status === 'pending' ? (
                <>
                  <button
                    onClick={() => onConfirm(flag.id)}
                    className="p-1.5 rounded-lg bg-white/80 hover:bg-white border border-current/20 transition-colors"
                    title="Confirm flag"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onNA(flag.id)}
                    className="p-1.5 rounded-lg bg-white/80 hover:bg-white border border-current/20 transition-colors"
                    title="Mark N/A"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </>
              ) : flag.status !== 'pending' ? (
                <span className="text-xs font-semibold px-2 py-1 rounded-md bg-white/60">
                  {flag.status === 'confirmed' ? 'Confirmed' : 'N/A'}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

interface LegalEntitySearchTabProps extends AgentTabReadOnlyProps {
  clientId: string
  clientName: string
  state?: string
  dba?: string
  entityType?: string
  businessAddress?: string
}

export default function LegalEntitySearchTab({
  clientId,
  clientName,
  state,
  dba,
  entityType,
  businessAddress,
  readOnly = false,
}: LegalEntitySearchTabProps) {
  const [savedReport, setSavedReport] = useState<WS110Persistence | null>(null)
  const [flags, setFlags] = useState<WS110Flag[]>([])
  const [activeTab, setActiveTab] = useState<'report' | 'flags'>('report')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [advisorToRun, setAdvisorToRun] = useState(false)
  const [warning, setWarning] = useState<string | null>(null)

  const { documents, setDocuments, clearAll, analyze, status, rawMarkdown, error } =
    useWS110Analysis({ clientId, clientName, state, dba, entityType, businessAddress })
  const { provider, setProvider } = useAgentAiProvider()
  const { historyItems, activeRun, activeId, setActiveId, reload, loading: loadingReport } = useAgentReportRuns(
    '/api/legal-entity-search/reports',
    clientId,
  )

  const isRunning = status === 'uploading' || status === 'streaming'

  useEffect(() => {
    fetch(`/api/client-data/${clientId}?section=legalEntityAdvisorToRun`)
      .then(r => r.ok ? r.json() : false)
      .catch(() => false)
      .then(advisorFlag => setAdvisorToRun(advisorFlag === true))
  }, [clientId])

  useEffect(() => {
    if (!activeRun?.markdown) {
      if (!loadingReport) setSavedReport(null)
      return
    }
    setSavedReport(activeRun as WS110Persistence)
    const { flags: pFlags } = parseWS110Markdown(activeRun.markdown, clientName)
    const savedStatuses = new Map(((activeRun.metadata as any)?.flags ?? []).map((f: any) => [f.id, f.status]))
    setFlags(pFlags.map(f => ({ ...f, status: (savedStatuses.get(f.id) as any) ?? 'pending' })))
  }, [activeRun, clientName, loadingReport])

  useEffect(() => {
    if (status === 'complete' && rawMarkdown) {
      void reload({ selectNewest: true }).then(() => {
        setToast({ message: 'Legal entity search analysis completed', type: 'success' })
      })
      clearAll()
    }
  }, [status, rawMarkdown, clearAll, reload])

  const handleFlagUpdate = async (id: string, action: 'confirmed' | 'na') => {
    const nextFlags = flags.map(f => (f.id === id ? { ...f, status: action as any } : f))
    setFlags(nextFlags)
    try {
      await fetch(`/api/legal-entity-search/reports?clientId=${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: { ...(savedReport?.metadata as any), flags: nextFlags.map(f => ({ id: f.id, status: f.status })) },
        }),
      })
    } catch {
      setToast({ message: 'Failed to save flag status', type: 'error' })
    }
  }

  const handleSaveMarkdown = async (markdown: string) => {
    const res = await fetch(`/api/legal-entity-search/reports?clientId=${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to save legal entity search report.')

    setSavedReport(data.report)
    const { flags: parsedFlags } = parseWS110Markdown(data.report.markdown, clientName)
    const savedStatuses = new Map(((data.report.metadata as any)?.flags ?? []).map((f: any) => [f.id, f.status]))
    setFlags(parsedFlags.map(f => ({ ...f, status: (savedStatuses.get(f.id) as any) ?? 'pending' })))
  }

  const handleNewAnalysis = () => {
    setSavedReport(null)
    setFlags([])
    clearAll()
  }

  const handleDelete = async () => {
    try {
      await fetch(`/api/legal-entity-search/reports?clientId=${clientId}`, { method: 'DELETE' })
      setSavedReport(null)
      setFlags([])
      clearAll()
      setToast({ message: 'Report deleted', type: 'success' })
    } catch {
      setToast({ message: 'Failed to delete report', type: 'error' })
    }
  }

  const handleRunAnalysis = () => {
    setWarning(null)
    const hasUcc = documents.some(d => d.name.toLowerCase().includes('ucc'))
    if (!hasUcc) {
      setWarning('No UCC search documents detected. Please upload UCC search files before running.')
      return
    }
    analyze(provider)
  }

  if (loadingReport) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-stone-200 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  // Client view gate when advisor to run is active
  if (advisorToRun && readOnly && !savedReport) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
        <p className="text-sm font-semibold text-slate-700">Search in Progress</p>
        <p className="text-xs text-slate-400 mt-2">Advisor is running this search.</p>
      </div>
    )
  }

  const readOnlyGate = agentTabReadOnlyGate(readOnly, loadingReport, Boolean(savedReport?.markdown), 'Legal Reports & Entity Search')
  if (readOnlyGate) return readOnlyGate

  if (!savedReport && !isRunning) {
    return (
      <div className="-m-6 bg-stone-50 min-h-[500px] p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          {advisorToRun && !readOnly && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
              This search is marked Advisor to Run in Agent Status. Upload the UCC search results here before running analysis.
            </div>
          )}
          <Card className="p-10 border-stone-200 shadow-sm bg-white">
            <DocumentUploader
              onDocumentsReady={setDocuments}
              onAnalyze={handleRunAnalysis}
              isLoading={isRunning}
              providerBar={!readOnly ? (
                <AgentProviderBar provider={provider} onProviderChange={setProvider} disabled={isRunning} />
              ) : undefined}
            />
            {warning && (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>{warning}</span>
              </div>
            )}
            {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
          </Card>
        </div>
      </div>
    )
  }

  if (isRunning && !savedReport) {
    return (
      <div className="-m-6 bg-stone-50 min-h-[500px] p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-12 border-stone-200 shadow-sm bg-white">
            <div className="flex flex-col items-center gap-8 text-center">
              <div className="w-12 h-12 border-4 border-stone-100 border-t-stone-800 rounded-full animate-spin" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-stone-900 tracking-tight">Analyzing legal entity documents...</h3>
                <p className="text-stone-500 max-w-sm mx-auto">
                  Reviewing UCC filings, entity standing, trademarks, and registered agent status. This takes 1-3 minutes.
                </p>
              </div>
              {rawMarkdown.length > 0 && (
                <div className="w-full bg-stone-50 border border-stone-200 rounded-xl p-8 text-left max-h-[450px] overflow-auto shadow-inner">
                  <div className="prose prose-stone prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{rawMarkdown}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    )
  }

  const { report } = parseWS110Markdown(savedReport?.markdown || '', clientName)
  const dealRiskCount = flags.filter(f => f.severity === 'deal-risk').length
  const negotiationCount = flags.filter(f => f.severity === 'negotiation').length
  const pendingCount = flags.filter(f => f.status === 'pending').length

  const tabs = readOnly
    ? [{ id: 'report' as const, label: 'Full Report' }]
    : [
        { id: 'report' as const, label: 'Full Report' },
        { id: 'flags' as const, label: `Flags (${flags.length})` },
      ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">Legal Reports & Entity Search</h2>
          <p className="text-xs text-stone-500 mt-1">
            Generated {savedReport?.createdAt ? new Date(savedReport.createdAt).toLocaleString() : '—'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {dealRiskCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                {dealRiskCount} Deal Risk{dealRiskCount !== 1 ? 's' : ''}
              </span>
            )}
            {negotiationCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
                {negotiationCount} Negotiation
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
              {flags.filter(f => f.severity === 'informational').length} Info
            </span>
          </div>
        </div>
        <AdvisorActions className="flex flex-wrap items-center gap-2 xl:justify-end">
          <AgentReportHistoryBar
            runs={historyItems}
            activeId={activeId}
            onSelect={(run) => setActiveId(run.id)}
            activeProvider={savedReport?.aiProvider}
            activeModel={savedReport?.aiModel}
          />
          {!readOnly && (
            <>
              <Button variant="outline" size="sm" onClick={handleNewAnalysis}>+ New Analysis</Button>
              <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 hover:text-red-700">Delete</Button>
            </>
          )}
          <ExportReportButton
            html={buildLegalEntitySearchReportHtml(report, flags, clientName)}
            fileName={`legal-entity-search-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
            label="Export PDF"
          />
        </AdvisorActions>
      </div>

      {!readOnly && pendingCount > 0 && flags.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <p className="text-sm text-amber-800">
            {pendingCount} of {flags.length} flags pending review.
          </p>
        </div>
      )}

      <Card className="overflow-hidden border-stone-200 shadow-sm bg-white">
        <div className="flex border-b border-stone-100 bg-stone-50/50 px-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-5 py-4 text-[12px] font-medium tracking-tight transition-all relative',
                activeTab === tab.id ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
              )}
            >
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-stone-800" />}
            </button>
          ))}
        </div>

        <div className="min-h-[500px] p-6">
          {activeTab === 'report' && savedReport?.markdown && (
            <InlineEditableMarkdownReport
              report={savedReport}
              markdownComponents={markdownComponents}
              onSave={handleSaveMarkdown}
              readOnly={readOnly}
            />
          )}
          {activeTab === 'flags' && !readOnly && (
            <FlagReviewPanel
              flags={flags}
              onConfirm={id => handleFlagUpdate(id, 'confirmed')}
              onNA={id => handleFlagUpdate(id, 'na')}
              readOnly={readOnly}
            />
          )}
        </div>
      </Card>

      {toast && (
        <div className={cn(
          'fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3',
          toast.type === 'success' ? 'bg-stone-900 text-white border-stone-800' : 'bg-red-50 text-red-700 border-red-200'
        )}>
          <div className={cn('w-2 h-2 rounded-full', toast.type === 'success' ? 'bg-amber-400' : 'bg-red-500')} />
          <p className="text-[14px] font-medium">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-4 opacity-50 hover:opacity-100">×</button>
        </div>
      )}
    </div>
  )
}
