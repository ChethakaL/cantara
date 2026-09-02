'use client'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import type { AgentTabReadOnlyProps } from '@/types/agent-tab'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, Button, cn, Badge } from '@/components/ui'
import { useWS111Analysis, type UploadedDoc } from '@/hooks/useWS111Analysis'
import { parseWS111Markdown } from '@/lib/ws1-11/parser'
import type { WS111Persistence, WS111Flag } from '@/types/ws1-11-types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import InlineEditableMarkdownReport from '@/components/report-export/InlineEditableMarkdownReport'
import { AdvisorActions } from '@/components/client-portal/AgentClientPortalFrame'
import { buildTaxLiabilityReportHtml } from '@/lib/report-export/build-tax-liability-report'
import { TAX_READINESS_DOCUMENT_GROUPS, buildTaxReadinessReferenceHtml } from '@/lib/tax-readiness'
import { Upload, FileText, X, AlertTriangle, CheckCircle2 } from 'lucide-react'
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

// ── Tax Readiness Checklist Panel ───────────────────────────────────────────

function TaxReadinessChecklist({
  clientName,
  groups,
  loading,
  error,
}: {
  clientName: string
  groups: TaxDocumentGroupStatus[]
  loading: boolean
  error: string | null
}) {
  const [open, setOpen] = useState(true)
  const requiredGroups = groups.filter(group => group.required)
  const uploadedRequired = requiredGroups.filter(group => group.uploaded).length

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 overflow-hidden mb-6">
      <div className="w-full flex items-center justify-between gap-3 px-5 py-3.5">
        <button type="button" onClick={() => setOpen(o => !o)} className="min-w-0 flex flex-1 items-center gap-2.5 text-left">
          <FileText className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-stone-800">Tax Readiness Checklist</span>
          <span className="text-[10px] font-medium text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">
            {uploadedRequired}/{requiredGroups.length} uploaded
          </span>
        </button>
        <div className="flex items-center gap-3">
          <ExportReportButton
            html={buildTaxReadinessReferenceHtml(clientName)}
            fileName={`${clientName} - Tax Readiness Document Reference.pdf`}
            label="Download PDF"
          />
          <button type="button" onClick={() => setOpen(o => !o)} className="text-stone-400 text-xs">{open ? '▲' : '▼'}</button>
        </div>
      </div>
      {open && (
        <div className="border-t border-amber-200 divide-y divide-amber-100 bg-white/40">
          {loading ? (
            <div className="px-5 py-4 text-xs text-stone-400">Loading uploaded tax documents...</div>
          ) : error ? (
            <div className="px-5 py-4 text-xs text-red-600">{error}</div>
          ) : (
            TAX_READINESS_DOCUMENT_GROUPS.map((group, index) => {
              const status = groups.find(item => item.id === group.id)
              const uploaded = Boolean(status?.uploaded)
              return (
                <div key={group.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-amber-200 flex items-center justify-center text-[10px] font-bold text-amber-800">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-stone-800">{group.title}</p>
                      {uploaded ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                          Needed
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 mt-0.5">{group.detail}</p>
                    {uploaded && status && status.documents.length > 0 && (
                      <p className="mt-1 text-[10px] font-medium text-emerald-700">
                        {status.documents.length} file{status.documents.length === 1 ? '' : 's'} uploaded
                      </p>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ── Document Uploader ───────────────────────────────────────────────────────

type TaxDocumentGroupStatus = {
  id: string
  title: string
  detail: string
  bestSource: string
  required: boolean
  uploaded: boolean
  documents: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number | null; uploadedAt: string }>
}

function DocumentUploader({
  documents,
  onDocumentsReady,
  onAnalyze,
  isLoading,
  missingRequiredCount = 0,
  providerBar,
}: {
  documents: UploadedDoc[]
  onDocumentsReady: (docs: UploadedDoc[]) => void
  onAnalyze: () => void
  isLoading: boolean
  missingRequiredCount?: number
  providerBar?: React.ReactNode
}) {
  const handleFiles = useCallback(async (fileList: FileList) => {
    const newDocs: UploadedDoc[] = []
    for (const file of Array.from(fileList)) {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      newDocs.push({
        name: file.name,
        base64,
        mediaType: file.type || 'application/octet-stream',
        slotKey: 'advisor_tax_upload',
        sizeBytes: file.size,
      })
    }
    onDocumentsReady([...documents, ...newDocs])
  }, [documents, onDocumentsReady])

  const removeFile = (name: string) => {
    onDocumentsReady(documents.filter(f => f.name !== name))
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center">
          <FileText className="w-8 h-8 text-stone-400" />
        </div>
        <h3 className="text-xl font-semibold text-stone-900 tracking-tight">Tax Liability Review</h3>
        <p className="text-stone-500 text-sm max-w-lg mx-auto">
          Review the client-uploaded tax files below. Add advisor-only files here if needed before running analysis.
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

      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map(f => (
            <div key={f.name} className="flex items-center gap-3 px-4 py-2.5 bg-stone-50 rounded-lg border border-stone-200">
              <FileText className="w-4 h-4 text-stone-400 flex-shrink-0" />
              <span className="text-sm text-stone-700 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-stone-400">{((f.sizeBytes ?? 0) / 1024).toFixed(0)} KB</span>
              <button onClick={() => removeFile(f.name)} className="text-stone-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {missingRequiredCount > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              {missingRequiredCount} required tax document group{missingRequiredCount === 1 ? '' : 's'} still missing. Upload the missing files in Document Upload before running this agent.
            </div>
          )}
          {providerBar}
          <Button onClick={onAnalyze} disabled={isLoading || missingRequiredCount > 0} className="w-full mt-4">
            {isLoading ? 'Analyzing...' : `Analyze ${documents.length} Document${documents.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      )}
      {documents.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          No tax files are attached yet. Ask the client to upload the required tax documents in Document Upload, or add files here.
        </div>
      )}
      {documents.length > 0 && (
        <p className="text-xs text-center text-stone-400">Draft uploads auto-save while you work.</p>
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
  flags: WS111Flag[]
  onConfirm: (id: string) => void
  onNA: (id: string) => void
  readOnly?: boolean
}) {
  const groups = [
    {
      key: 'deal-risk' as const,
      title: 'Red Flags — Requires Immediate Attention',
      emoji: '🔴',
      tone: 'rose' as const,
      badge: 'red' as const,
      cardClass: 'bg-[#fef2f2] border-rose-200',
      titleClass: 'text-rose-700',
      iconClass: 'text-[#8a2f2c]',
    },
    {
      key: 'negotiation' as const,
      title: 'Yellow Flags — Requires Clarification',
      emoji: '🟡',
      tone: 'amber' as const,
      badge: 'gold' as const,
      cardClass: 'bg-[#fffbeb] border-amber-200',
      titleClass: 'text-amber-700',
      iconClass: 'text-amber-700',
    },
    {
      key: 'informational' as const,
      title: 'Green Flags — Informational',
      emoji: '🟢',
      tone: 'emerald' as const,
      badge: 'green' as const,
      cardClass: 'bg-emerald-50 border-emerald-100',
      titleClass: 'text-emerald-700',
      iconClass: 'text-emerald-700',
    },
  ]

  const renderControls = (flag: WS111Flag) => {
    if (readOnly) {
      if (flag.status === 'confirmed') return <div className="mt-3 pt-3 border-t border-black/5"><Badge color="blue">Reviewed</Badge></div>
      if (flag.status === 'na') return <div className="mt-3 pt-3 border-t border-black/5"><Badge color="slate">Not Applicable</Badge></div>
      return null
    }

    const labelClass =
      flag.severity === 'deal-risk'
        ? 'border-rose-200 bg-white/70 text-rose-700'
        : flag.severity === 'negotiation'
          ? 'border-amber-200 bg-white/70 text-amber-700'
          : 'border-emerald-200 bg-white/70 text-emerald-700'

    return (
      <div className="mt-3 pt-3 border-t border-black/5 flex items-center justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Admin Review</p>
          <div className="flex items-center gap-2 flex-wrap">
            <label className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${labelClass}`}>
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={flag.status === 'confirmed'}
                onChange={event => {
                  if (event.target.checked) onConfirm(flag.id)
                }}
              />
              Relevant
            </label>
            <label className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${labelClass}`}>
              <input
                type="checkbox"
                className="rounded border-slate-300"
                checked={flag.status === 'na'}
                onChange={event => {
                  if (event.target.checked) onNA(flag.id)
                }}
              />
              Not applicable
            </label>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {flag.status === 'confirmed' && <Badge color="blue">Reviewed</Badge>}
          {flag.status === 'na' && <Badge color="slate">Not Applicable</Badge>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!readOnly && (
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
        <p className="text-xs leading-relaxed text-blue-800">
          Resolved flags are incorporated into the final tax liability summary. Once all flags are reviewed, the report can be exported with flag resolutions included.
        </p>
      </div>
      )}
      {groups.map(group => {
        const sectionFlags = flags.filter(flag => flag.severity === group.key)
        if (!sectionFlags.length) return null
        return (
          <section key={group.key}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">{group.emoji}</span>
              <h5 className={`font-semibold ${group.titleClass}`}>{group.title}</h5>
              <Badge color={group.badge}>{sectionFlags.length}</Badge>
            </div>
            <div className="space-y-3">
              {sectionFlags.map(flag => (
                <div
                  key={flag.id}
                  className={cn(
                    'p-4 rounded-sm border shadow-sm transition-shadow hover:shadow-md',
                    flag.status === 'na' ? 'bg-slate-50 border-slate-200 opacity-70' : group.cardClass,
                  )}
                >
                  <div className="flex items-start gap-4">
                    <AlertTriangle className={cn('mt-1 h-[18px] w-[18px] shrink-0', group.iconClass)} strokeWidth={2.5} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{flag.domain}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{flag.severity}</span>
                      </div>
                      <h4 className={cn('text-[17px] font-bold leading-tight tracking-tight', group.titleClass)}>
                        {flag.title}
                      </h4>
                      {flag.sourceRef && (
                        <p className="mt-2 text-[11px] font-bold uppercase tracking-wider opacity-70">
                          Source: {flag.sourceRef}
                        </p>
                      )}
                    </div>
                  </div>
                  {renderControls(flag)}
                </div>
              ))}
            </div>
          </section>
        )
      })}
      {flags.length === 0 && <p className="text-sm text-stone-400">No flags identified.</p>}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

interface TaxLiabilityReviewTabProps extends AgentTabReadOnlyProps {
  clientId: string
  clientName: string
  state?: string
  entityType?: string
}

export default function TaxLiabilityReviewTab({
  clientId,
  clientName,
  state,
  entityType,
  readOnly = false,
}: TaxLiabilityReviewTabProps) {
  const [savedReport, setSavedReport] = useState<WS111Persistence | null>(null)
  const [flags, setFlags] = useState<WS111Flag[]>([])
  const [activeTab, setActiveTab] = useState<'report' | 'flags'>('report')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [taxDocGroups, setTaxDocGroups] = useState<TaxDocumentGroupStatus[]>([])
  const [loadingTaxDocs, setLoadingTaxDocs] = useState(true)
  const [taxDocsError, setTaxDocsError] = useState<string | null>(null)

  const { documents, setDocuments, clearAll, analyze, status, rawMarkdown, error } =
    useWS111Analysis({ clientId, clientName, state, entityType })
  const { provider, setProvider } = useAgentAiProvider()
  const { historyItems, activeRun, activeId, setActiveId, reload, loading: loadingReport } = useAgentReportRuns(
    '/api/tax-liability-review/reports',
    clientId,
  )

  const isRunning = status === 'uploading' || status === 'streaming'
  const [draftLoaded, setDraftLoaded] = useState(false)
  const missingRequiredCount = taxDocGroups.filter(group => group.required && !group.uploaded).length

  useEffect(() => {
    let active = true
    setLoadingTaxDocs(true)
    setTaxDocsError(null)
    fetch(`/api/tax-liability-review/client-documents?clientId=${encodeURIComponent(clientId)}&includeContent=true`, { cache: 'no-store' })
      .then(async res => {
        if (!res.ok) throw new Error(await res.text())
        return res.json()
      })
      .then(data => {
        if (!active) return
        setTaxDocGroups((data.groups ?? []) as TaxDocumentGroupStatus[])
        const clientDocs = (data.documents ?? []) as UploadedDoc[]
        if (clientDocs.length > 0) {
          setDocuments(current => {
            const seen = new Set<string>()
            const next: UploadedDoc[] = []
            for (const doc of [...clientDocs, ...current]) {
              const key = `${doc.slotKey}:${doc.name}`
              if (seen.has(key)) continue
              seen.add(key)
              next.push(doc)
            }
            return next
          })
        }
      })
      .catch(err => {
        if (active) setTaxDocsError(err instanceof Error ? err.message : 'Failed to load tax documents.')
      })
      .finally(() => {
        if (active) setLoadingTaxDocs(false)
      })
    return () => { active = false }
  }, [clientId, setDocuments])

  useEffect(() => {
    let active = true
    fetch(`/api/tax-liability-review/draft?clientId=${encodeURIComponent(clientId)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!active || !data?.draft?.documents?.length) return
        setDocuments(data.draft.documents)
      })
      .catch(console.error)
      .finally(() => {
        if (active) setDraftLoaded(true)
      })
    return () => { active = false }
  }, [clientId, setDocuments])

  useEffect(() => {
    if (!draftLoaded || savedReport || isRunning) return
    if (!documents.length) {
      void fetch(`/api/tax-liability-review/draft?clientId=${encodeURIComponent(clientId)}`, { method: 'DELETE' })
      return
    }

    const timeout = window.setTimeout(() => {
      void fetch('/api/tax-liability-review/draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, documents }),
      }).catch(console.error)
    }, 700)

    return () => window.clearTimeout(timeout)
  }, [clientId, documents, draftLoaded, isRunning, savedReport])

  useEffect(() => {
    if (!activeRun?.markdown) {
      if (!loadingReport) setSavedReport(null)
      return
    }
    setSavedReport(activeRun as WS111Persistence)
    const { flags: pFlags } = parseWS111Markdown(activeRun.markdown, clientName)
    const savedStatuses = new Map(((activeRun.metadata as any)?.flags ?? []).map((f: any) => [f.id, f.status]))
    setFlags(pFlags.map(f => ({ ...f, status: (savedStatuses.get(f.id) as any) ?? 'pending' })))
  }, [activeRun, clientName, loadingReport])

  useEffect(() => {
    if (status === 'complete' && rawMarkdown) {
      void reload({ selectNewest: true }).then(() => {
        setToast({ message: 'Tax liability review completed', type: 'success' })
      })
      clearAll()
      void fetch(`/api/tax-liability-review/draft?clientId=${encodeURIComponent(clientId)}`, { method: 'DELETE' })
    }
  }, [status, rawMarkdown, clearAll, reload, clientId])

  const handleFlagUpdate = async (id: string, action: 'confirmed' | 'na') => {
    const nextFlags = flags.map(f => (f.id === id ? { ...f, status: action as any } : f))
    setFlags(nextFlags)
    try {
      await fetch(`/api/tax-liability-review/reports?clientId=${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: { flags: nextFlags.map(f => ({ id: f.id, status: f.status })) },
        }),
      })
    } catch {
      setToast({ message: 'Failed to save flag status', type: 'error' })
    }
  }

  const handleSaveMarkdown = async (markdown: string) => {
    const res = await fetch(`/api/tax-liability-review/reports?clientId=${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to save tax liability report.')

    setSavedReport(data.report)
    const { flags: parsedFlags } = parseWS111Markdown(data.report.markdown, clientName)
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
      await fetch(`/api/tax-liability-review/reports?clientId=${clientId}`, { method: 'DELETE' })
      setSavedReport(null)
      setFlags([])
      clearAll()
      setToast({ message: 'Report deleted', type: 'success' })
    } catch {
      setToast({ message: 'Failed to delete report', type: 'error' })
    }
  }

  if (loadingReport) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-stone-200 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }


  const readOnlyGate = agentTabReadOnlyGate(readOnly, loadingReport, Boolean(savedReport?.markdown), 'Tax Liability Review')
  if (readOnlyGate) return readOnlyGate

  if (!savedReport && !isRunning) {
    return (
      <div className="-m-6 bg-stone-50 min-h-[500px] p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-10 border-stone-200 shadow-sm">
            <TaxReadinessChecklist
              clientName={clientName}
              groups={taxDocGroups}
              loading={loadingTaxDocs}
              error={taxDocsError}
            />
            <DocumentUploader
              documents={documents}
              onDocumentsReady={setDocuments}
              onAnalyze={() => analyze(provider)}
              isLoading={isRunning}
              missingRequiredCount={missingRequiredCount}
              providerBar={!readOnly ? (
                <AgentProviderBar provider={provider} onProviderChange={setProvider} disabled={isRunning} />
              ) : undefined}
            />
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
                <h3 className="text-xl font-semibold text-stone-900 tracking-tight">Analyzing tax documents...</h3>
                <p className="text-stone-500 max-w-sm mx-auto">
                  Reviewing tax returns, liabilities, audit history, and compliance. This takes 2-4 minutes.
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

  const { report } = parseWS111Markdown(savedReport?.markdown || '', clientName)
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
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">Tax Liability Review</h2>
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
            html={buildTaxLiabilityReportHtml(report, flags, clientName)}
            fileName={`tax-liability-review-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
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
