'use client'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import type { AgentTabReadOnlyProps } from '@/types/agent-tab'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
import {
  Upload,
  FileText,
  X,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Play,
  Loader2,
  RefreshCw,
  Scale,
  Building2,
  ShieldCheck,
  Award,
  UserCheck,
  AlertCircle,
  Trash2,
} from 'lucide-react'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { useAgentReportRuns } from '@/hooks/useAgentReportRuns'
import {
  listClientDocuments,
  fetchClientDocumentAsBase64,
  type ClientUploadedDoc,
} from '@/lib/client-documents-client'

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

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface CategoryDef {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  portalIds?: string[]
}

const UCC_CATEGORY: CategoryDef = {
  id: 'ucc_search_results',
  label: 'UCC Search Results',
  description:
    'Uniform Commercial Code lien search reports, active UCC-1 financing statements, continuation filings, and secured debt schedules.',
  icon: Scale,
}

const OPTIONAL_CATEGORIES: CategoryDef[] = [
  {
    id: 'sos_filings',
    label: 'Secretary of State Filings',
    description:
      'Articles of incorporation or organization, certificates of formation, corporate amendments, and official state registry records.',
    icon: Building2,
    portalIds: ['articles_org', 'org_document_amendments', 'annual_reports'],
  },
  {
    id: 'good_standing',
    label: 'Certificates of Good Standing',
    description:
      'Current certificate of good standing, certificate of existence, or state tax compliance certificate confirming active corporate status.',
    icon: ShieldCheck,
    portalIds: ['good_standing_certificate'],
  },
  {
    id: 'corporate_docs',
    label: 'Corporate Governance Documents',
    description:
      'Operating agreements, company bylaws, shareholder agreements, partnership agreements, and official corporate resolutions.',
    icon: FileText,
    portalIds: ['operating_agreement_bylaws', 'shareholder_agreement'],
  },
  {
    id: 'trademark_registrations',
    label: 'Trademark & IP Registrations',
    description:
      'USPTO trademark registration certificates, state trademark filings, brand copyrights, and intellectual property assignments.',
    icon: Award,
  },
  {
    id: 'registered_agent_confirmations',
    label: 'Registered Agent Confirmations',
    description:
      'Registered agent appointment confirmations, service of process notices, and annual agent verification documents.',
    icon: UserCheck,
  },
]

const ALL_PORTAL_IDS = [
  'articles_org',
  'org_document_amendments',
  'annual_reports',
  'good_standing_certificate',
  'operating_agreement_bylaws',
  'shareholder_agreement',
]

// ── Legal Document Row Component ───────────────────────────────────────────

function LegalDocRow({
  category,
  files,
  portalDocs,
  required,
  onUpload,
  onRemove,
  onImportPortalDoc,
  importingPortalId,
  readOnly = false,
}: {
  category: CategoryDef
  files: UploadedDoc[]
  portalDocs: ClientUploadedDoc[]
  required: boolean
  onUpload: (fileList: FileList | File[]) => void
  onRemove: (name: string) => void
  onImportPortalDoc: (doc: ClientUploadedDoc) => void
  importingPortalId: string | null
  readOnly?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const hasFiles = files.length > 0
  const IconComponent = category.icon

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!readOnly) setIsDragOver(true)
      }}
      onDragLeave={(e) => {
        e.preventDefault()
        setIsDragOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragOver(false)
        if (!readOnly && e.dataTransfer.files?.length) {
          onUpload(e.dataTransfer.files)
        }
      }}
      className={cn(
        'rounded-xl border p-4 transition-all shadow-2xs',
        isDragOver
          ? 'border-amber-400 bg-amber-50/50'
          : hasFiles
            ? 'border-emerald-200 bg-emerald-50/40'
            : required
              ? 'border-amber-200/90 bg-amber-50/20'
              : 'border-slate-200/80 bg-white hover:border-slate-300',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                hasFiles
                  ? 'bg-emerald-50 text-emerald-600'
                  : required
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-slate-100 text-slate-500',
              )}
            >
              <IconComponent className="w-4.5 h-4.5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-800">{category.label}</p>
                {required ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                    Required (Advisor Mode)
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    Optional
                  </span>
                )}

                {hasFiles ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    {files.length} ready
                  </span>
                ) : required ? (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                    Required / Missing
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-200">
                    Not provided
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{category.description}</p>

              {/* Uploaded File Chips */}
              {hasFiles && (
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {files.map((file) => (
                    <div
                      key={file.name}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-emerald-200 text-emerald-900 shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate max-w-[220px] font-medium" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({formatFileSize(file.sizeBytes)})
                      </span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => onRemove(file.name)}
                          className="text-slate-400 hover:text-rose-600 ml-1 transition-colors"
                          title="Remove document"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Portal Files detected for this slot */}
              {portalDocs.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-slate-100">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Available in Client Portal
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {portalDocs.map((pDoc) => {
                      const isImported = files.some((f) => f.name === pDoc.fileName)
                      const isImporting = importingPortalId === pDoc.id
                      return (
                        <div
                          key={pDoc.id}
                          className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs bg-slate-50 border border-slate-200 text-slate-700"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[200px]" title={pDoc.fileName}>
                            {pDoc.fileName}
                          </span>
                          {isImported ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Imported
                            </span>
                          ) : (
                            !readOnly && (
                              <button
                                type="button"
                                onClick={() => onImportPortalDoc(pDoc)}
                                disabled={isImporting}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition-colors disabled:opacity-50"
                              >
                                {isImporting ? (
                                  <>
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> Importing
                                  </>
                                ) : (
                                  'Import'
                                )}
                              </button>
                            )
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upload Button */}
        {!readOnly && (
          <div className="shrink-0 pt-0.5">
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onUpload(e.target.files)
                }
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              className="gap-1.5 h-8 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              {hasFiles ? 'Add files' : 'Upload file(s)'}
            </Button>
          </div>
        )}
      </div>
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
  const [composingNew, setComposingNew] = useState(false)

  // Portal documents state
  const [portalDocs, setPortalDocs] = useState<ClientUploadedDoc[]>([])
  const [loadingPortalDocs, setLoadingPortalDocs] = useState(false)
  const [importingPortalId, setImportingPortalId] = useState<string | null>(null)

  const { documents, setDocuments, removeDocument, clearAll, analyze, status, rawMarkdown, error } =
    useWS110Analysis({ clientId, clientName, state, dba, entityType, businessAddress })
  const { provider, setProvider } = useAgentAiProvider()
  const { historyItems, activeRun, activeId, setActiveId, reload, loading: loadingReport } = useAgentReportRuns(
    '/api/legal-entity-search/reports',
    clientId,
  )

  const isRunning = status === 'uploading' || status === 'streaming'

  // Fetch advisorToRun status
  useEffect(() => {
    fetch(`/api/client-data/${clientId}?section=legalEntityAdvisorToRun`)
      .then((r) => (r.ok ? r.json() : false))
      .catch(() => false)
      .then((advisorFlag) => setAdvisorToRun(advisorFlag === true))
  }, [clientId])

  // Load client portal documents
  const loadPortalDocs = useCallback(async () => {
    setLoadingPortalDocs(true)
    try {
      const docs = await listClientDocuments(clientId, ALL_PORTAL_IDS)
      setPortalDocs(docs)
    } catch (err) {
      console.error('Failed to load portal docs for legal search', err)
    } finally {
      setLoadingPortalDocs(false)
    }
  }, [clientId])

  useEffect(() => {
    void loadPortalDocs()
  }, [loadPortalDocs])

  // Active run updates
  useEffect(() => {
    if (!activeRun?.markdown) {
      if (!loadingReport) setSavedReport(null)
      return
    }
    setSavedReport(activeRun as WS110Persistence)
    const { flags: pFlags } = parseWS110Markdown(activeRun.markdown, clientName)
    const savedStatuses = new Map(((activeRun.metadata as any)?.flags ?? []).map((f: any) => [f.id, f.status]))
    setFlags(pFlags.map((f) => ({ ...f, status: (savedStatuses.get(f.id) as any) ?? 'pending' })))
  }, [activeRun, clientName, loadingReport])

  // Reload when complete
  useEffect(() => {
    if (status === 'complete' && rawMarkdown) {
      void reload({ selectNewest: true }).then(() => {
        setToast({ message: 'Legal entity search analysis completed', type: 'success' })
        setComposingNew(false)
      })
      clearAll()
    }
  }, [status, rawMarkdown, clearAll, reload])

  // Upload handlers
  const handleSlotUpload = async (slotKey: string, fileList: FileList | File[]) => {
    const newDocs: UploadedDoc[] = []
    for (const file of Array.from(fileList)) {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      newDocs.push({
        name: file.name,
        base64,
        mediaType: file.type || 'application/octet-stream',
        slotKey,
        sizeBytes: file.size,
      })
    }
    setDocuments((prev) => [
      ...prev.filter((d) => !newDocs.some((n) => n.name === d.name)),
      ...newDocs,
    ])
  }

  const handleImportPortalDoc = async (pDoc: ClientUploadedDoc, slotKey: string) => {
    setImportingPortalId(pDoc.id)
    try {
      const docData = await fetchClientDocumentAsBase64({
        clientId,
        documentId: pDoc.documentId,
        recordId: pDoc.id,
        fileName: pDoc.fileName,
        mimeType: pDoc.mimeType,
      })
      setDocuments((prev) => [
        ...prev.filter((d) => d.name !== docData.name),
        {
          name: docData.name,
          base64: docData.base64,
          mediaType: docData.mediaType,
          slotKey,
          sizeBytes: docData.sizeBytes,
        },
      ])
      setToast({ message: `Imported "${pDoc.fileName}" from client portal`, type: 'success' })
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to import document', type: 'error' })
    } finally {
      setImportingPortalId(null)
    }
  }

  const handleFlagUpdate = async (id: string, action: 'confirmed' | 'na') => {
    const nextFlags = flags.map((f) => (f.id === id ? { ...f, status: action as any } : f))
    setFlags(nextFlags)
    try {
      await fetch(`/api/legal-entity-search/reports?clientId=${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: {
            ...(savedReport?.metadata as any),
            flags: nextFlags.map((f) => ({ id: f.id, status: f.status })),
          },
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
    setFlags(parsedFlags.map((f) => ({ ...f, status: (savedStatuses.get(f.id) as any) ?? 'pending' })))
  }

  const handleNewAnalysis = () => {
    setComposingNew(true)
    setWarning(null)
  }

  const handleDelete = async () => {
    try {
      await fetch(`/api/legal-entity-search/reports?clientId=${clientId}`, { method: 'DELETE' })
      setSavedReport(null)
      setFlags([])
      clearAll()
      setComposingNew(false)
      setToast({ message: 'Report deleted', type: 'success' })
      await reload()
    } catch {
      setToast({ message: 'Failed to delete report', type: 'error' })
    }
  }

  // Document calculations
  const uccDocs = useMemo(
    () =>
      documents.filter(
        (d) => d.slotKey === 'ucc_search_results' || d.name.toLowerCase().includes('ucc'),
      ),
    [documents],
  )
  const hasUcc = uccDocs.length > 0

  const optionalDocsCount = useMemo(
    () => documents.filter((d) => d.slotKey !== 'ucc_search_results').length,
    [documents],
  )

  const canRun = advisorToRun ? hasUcc : documents.length > 0

  const handleRunAnalysis = () => {
    setWarning(null)
    if (advisorToRun && !hasUcc) {
      setWarning('UCC search results document required before running advisor analysis.')
      return
    }
    if (documents.length === 0) {
      setWarning('Please upload at least one legal entity document before running analysis.')
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

  const readOnlyGate = agentTabReadOnlyGate(
    readOnly,
    loadingReport,
    Boolean(savedReport?.markdown),
    'Legal Reports & Entity Search',
  )
  if (readOnlyGate) return readOnlyGate

  const hasExistingReport = Boolean(savedReport?.markdown)
  const showActiveReport = Boolean(hasExistingReport && !composingNew)

  const { report } = parseWS110Markdown(savedReport?.markdown || '', clientName)
  const dealRiskCount = flags.filter((f) => f.severity === 'deal-risk').length
  const negotiationCount = flags.filter((f) => f.severity === 'negotiation').length
  const pendingCount = flags.filter((f) => f.status === 'pending').length

  const tabs = readOnly
    ? [{ id: 'report' as const, label: 'Full Report' }]
    : [
        { id: 'report' as const, label: 'Full Report' },
        { id: 'flags' as const, label: `Flags (${flags.length})` },
      ]

  return (
    <div className="space-y-6">
      {/* Unified Provider & History Toolbar */}
      {!readOnly && (
        <AgentRunToolbar
          provider={provider}
          onProviderChange={setProvider}
          disabled={isRunning}
          historyItems={historyItems}
          activeId={activeId}
          onSelectRun={(run) => {
            setActiveId(run.id)
            setComposingNew(false)
          }}
          activeProvider={savedReport?.aiProvider}
          activeModel={savedReport?.aiModel}
          activeVersion={savedReport?.version}
        />
      )}

      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            {showActiveReport
              ? 'Legal Reports & Entity Search Report'
              : composingNew
                ? 'New Legal Entity Search'
                : 'Legal Reports & Entity Search'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {showActiveReport
              ? `Corporate documents, SOS filings, UCC liens & good standing compliance for ${clientName}`
              : `Upload corporate documents, Secretary of State filings, UCC search results & IP records for ${clientName}`}
          </p>
        </div>

        {!readOnly && (
          <AdvisorActions className="flex items-center gap-2 shrink-0">
            {showActiveReport && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNewAnalysis}
                  className="gap-1.5 h-8 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                  New Analysis
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="gap-1.5 h-8 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-slate-200"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
                <ExportReportButton
                  html={buildLegalEntitySearchReportHtml(report, flags, clientName)}
                  fileName={`legal-entity-search-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
                  label="Export PDF"
                />
              </>
            )}
            {composingNew && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setComposingNew(false)
                  setWarning(null)
                }}
                className="h-8 text-xs font-medium text-slate-700"
              >
                Cancel
              </Button>
            )}
          </AdvisorActions>
        )}
      </div>

      {/* Advisor to Run notification badge */}
      {advisorToRun && !readOnly && !showActiveReport && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs text-blue-800 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            <strong className="font-semibold">Advisor to Run Active:</strong> UCC Search Results are uploaded directly by the advisor and are required to run the legal entity analysis.
          </span>
        </div>
      )}

      {/* ── Running View (Streaming or Uploading) ── */}
      {isRunning && (
        <div className="rounded-xl border border-slate-200 bg-white p-12 shadow-2xs">
          <div className="flex flex-col items-center gap-8 text-center">
            <div className="w-12 h-12 border-4 border-slate-100 border-t-slate-800 rounded-full animate-spin" />
            <div className="space-y-2">
              <h3 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
                Analyzing legal entity documents...
              </h3>
              <p className="text-slate-500 text-xs max-w-md mx-auto">
                Reviewing UCC filings, entity standing, Secretary of State records, trademarks, and registered agent status. This takes 1–3 minutes.
              </p>
            </div>
            {rawMarkdown.length > 0 && (
              <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-6 text-left max-h-[450px] overflow-auto shadow-inner">
                <div className="prose prose-stone prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{rawMarkdown}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Document Configuration Workspace ── */}
      {!isRunning && (!showActiveReport || composingNew) && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
          {/* Sector 1: UCC Search Results */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {advisorToRun ? 'Required UCC Search Results' : 'UCC Search Results & Liens'}
                </h4>
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                    hasUcc
                      ? 'bg-emerald-100 text-emerald-800'
                      : advisorToRun
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {hasUcc ? `${uccDocs.length} file${uccDocs.length !== 1 ? 's' : ''} ready` : advisorToRun ? '0 of 1 ready' : '0 uploaded'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void loadPortalDocs()}
                disabled={loadingPortalDocs}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3 h-3', loadingPortalDocs && 'animate-spin')} />
                Refresh Portal Docs
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {advisorToRun
                ? 'Uniform Commercial Code (UCC) lien searches must be uploaded by the advisor to examine active financing statements and secured debt.'
                : 'Upload UCC-1 financing statements, continuation filings, or state/county UCC public search certificates.'}
            </p>

            <LegalDocRow
              category={UCC_CATEGORY}
              files={uccDocs}
              portalDocs={[]}
              required={advisorToRun}
              onUpload={(files) => void handleSlotUpload('ucc_search_results', files)}
              onRemove={removeDocument}
              onImportPortalDoc={() => {}}
              importingPortalId={null}
              readOnly={readOnly}
            />
          </div>

          {/* Sector 2: Optional Legal Entity Documents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Optional Legal Entity Documents
                </h4>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {optionalDocsCount} uploaded
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Upload corporate governance records, Secretary of State filings, certificates of good standing, trademark registrations, and registered agent confirmations for comprehensive legal due diligence.
            </p>

            <div className="space-y-3">
              {OPTIONAL_CATEGORIES.map((category) => {
                const categoryFiles = documents.filter((d) => d.slotKey === category.id)
                const relevantPortalDocs = portalDocs.filter((p) =>
                  category.portalIds ? category.portalIds.includes(p.documentId) : false,
                )

                return (
                  <LegalDocRow
                    key={category.id}
                    category={category}
                    files={categoryFiles}
                    portalDocs={relevantPortalDocs}
                    required={false}
                    onUpload={(files) => void handleSlotUpload(category.id, files)}
                    onRemove={removeDocument}
                    onImportPortalDoc={(pDoc) => void handleImportPortalDoc(pDoc, category.id)}
                    importingPortalId={importingPortalId}
                    readOnly={readOnly}
                  />
                )
              })}
            </div>
          </div>

          {/* Warning notice */}
          {warning && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>{warning}</span>
            </div>
          )}

          {/* Error notice */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Bottom Readiness & Action Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-xs">
              {canRun ? (
                <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Documents ready ({documents.length} file{documents.length !== 1 ? 's' : ''}). You can run legal entity analysis.
                </span>
              ) : advisorToRun ? (
                <span className="text-amber-800 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  Upload required UCC search results to run legal entity analysis.
                </span>
              ) : (
                <span className="text-slate-500 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                  Upload at least one legal entity document to run analysis.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {documents.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAll}
                  disabled={isRunning}
                  className="h-8 text-xs text-slate-600 hover:text-rose-600"
                >
                  Clear All
                </Button>
              )}
              {composingNew && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setComposingNew(false)
                    setWarning(null)
                  }}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleRunAnalysis}
                disabled={!canRun || isRunning}
                className={cn(
                  'gap-1.5 h-8 text-xs font-medium',
                  canRun
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed',
                )}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Run Legal Entity Analysis
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active Report View ── */}
      {showActiveReport && (
        <div className="space-y-6">
          {/* Executive KPI badges & metadata */}
          <div className="flex flex-wrap items-center gap-2">
            {dealRiskCount > 0 && (
              <span className="px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                {dealRiskCount} Deal Risk{dealRiskCount !== 1 ? 's' : ''}
              </span>
            )}
            {negotiationCount > 0 && (
              <span className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
                {negotiationCount} Negotiation Item{negotiationCount !== 1 ? 's' : ''}
              </span>
            )}
            <span className="px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
              {flags.filter((f) => f.severity === 'informational').length} Informational
            </span>
            <span className="text-xs text-slate-400 ml-2">
              Generated {savedReport?.createdAt ? new Date(savedReport.createdAt).toLocaleString() : '—'}
            </span>
          </div>

          {!readOnly && pendingCount > 0 && flags.length > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800">
                {pendingCount} of {flags.length} flags pending advisor review.
              </p>
            </div>
          )}

          <Card className="overflow-hidden border-slate-200 shadow-2xs bg-white">
            <div className="flex border-b border-slate-100 bg-slate-50/50 px-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'px-5 py-4 text-xs font-semibold tracking-tight transition-all relative',
                    activeTab === tab.id ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600',
                  )}
                >
                  {tab.label}
                  {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-slate-900" />}
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
                  onConfirm={(id) => handleFlagUpdate(id, 'confirmed')}
                  onNA={(id) => handleFlagUpdate(id, 'na')}
                  readOnly={readOnly}
                />
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Floating Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3',
            toast.type === 'success'
              ? 'bg-slate-900 text-white border-slate-800'
              : 'bg-red-50 text-red-700 border-red-200',
          )}
        >
          <div className={cn('w-2 h-2 rounded-full', toast.type === 'success' ? 'bg-amber-400' : 'bg-red-500')} />
          <p className="text-xs font-medium">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-4 opacity-50 hover:opacity-100">
            ×
          </button>
        </div>
      )}
    </div>
  )
}
