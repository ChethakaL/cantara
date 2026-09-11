'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText,
  Loader2,
  Play,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react'
import { Button, Card, cn } from '@/components/ui'
import { getAdminEmail, type DocumentStatus } from '@/lib/store'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import InlineEditableMarkdownReport from '@/components/report-export/InlineEditableMarkdownReport'
import { generateReportHtml } from '@/lib/report-export/generate-report-html'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { useAgentReportRuns } from '@/hooks/useAgentReportRuns'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import {
  fetchClientDocumentFile,
  listClientDocuments,
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center space-y-3">
          <div className="mx-auto w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center font-bold text-lg">
            !
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900">Delete Appraisal Analysis?</h3>
            <p className="text-xs text-slate-500">
              Are you sure you want to permanently delete this Real Estate Appraisal report? This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex border-t border-slate-100 p-3 gap-2 bg-slate-50/50 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs cursor-pointer">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className="h-8 text-xs bg-rose-600 text-white hover:bg-rose-700 border-none cursor-pointer"
          >
            Confirm Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusToast({
  message,
  type,
  onClose,
}: {
  message: string
  type: 'success' | 'error'
  onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={cn(
        'fixed bottom-8 right-8 z-[100] px-5 py-3 rounded-xl shadow-lg border flex items-center gap-2.5 animate-in slide-in-from-right-8 duration-300',
        type === 'success' ? 'bg-slate-900 text-white border-slate-800' : 'bg-rose-50 text-rose-700 border-rose-200'
      )}
    >
      <div className={cn('w-2 h-2 rounded-full', type === 'success' ? 'bg-emerald-400' : 'bg-rose-500')} />
      <p className="text-xs font-medium tracking-tight">{message}</p>
      <button onClick={onClose} className="ml-3 text-slate-400 hover:text-slate-200 transition-colors text-xs">
        ✕
      </button>
    </div>
  )
}

interface Props {
  clientId: string
  clientName: string
  documentStatuses?: Record<string, DocumentStatus>
  onRefreshDocuments?: () => Promise<void> | void
  readOnly?: boolean
}

export default function RealEstateAppraisalTab({
  clientId,
  clientName,
  documentStatuses,
  onRefreshDocuments,
  readOnly = false,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const [composingNew, setComposingNew] = useState(false)
  const [stagedFile, setStagedFile] = useState<File | null>(null)
  const [portalDocs, setPortalDocs] = useState<ClientUploadedDoc[]>([])
  const [loadingPortalDocs, setLoadingPortalDocs] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { provider, setProvider } = useAgentAiProvider()
  const { historyItems, activeRun, activeId, setActiveId, reload } = useAgentReportRuns(
    '/api/real-estate-appraisal/reports',
    clientId,
  )
  const report = activeRun

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
  }

  const loadPortalDocs = useCallback(async () => {
    setLoadingPortalDocs(true)
    try {
      const docs = await listClientDocuments(clientId, ['real_estate_appraisal'])
      setPortalDocs(docs)
      return docs
    } catch {
      return [] as ClientUploadedDoc[]
    } finally {
      setLoadingPortalDocs(false)
    }
  }, [clientId])

  const load = useCallback(async (options?: { selectNewest?: boolean }) => {
    try {
      await Promise.all([
        reload(options?.selectNewest ? { selectNewest: true } : undefined),
        loadPortalDocs(),
      ])
    } catch (error) {
      console.error('[RealEstateAppraisalTab] load failed', error)
      setRunError(error instanceof Error ? error.message : 'Failed to load appraisal data.')
    }
  }, [loadPortalDocs, reload])

  useEffect(() => {
    setLoading(true)
    setRunError('')
    void load().finally(() => setLoading(false))
  }, [load])

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
    showToast('Report changes saved')
  }, [clientId, report?.id, reload])

  const handleDeleteConfirmed = async () => {
    if (!report?.id) return
    setDeleting(true)
    try {
      const params = new URLSearchParams({ clientId, id: report.id })
      const res = await fetch(`/api/real-estate-appraisal/reports?${params.toString()}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error('Failed to delete report')
      }
      showToast('Appraisal report deleted')
      setDeleteOpen(false)
      setComposingNew(false)
      await reload({ selectNewest: true })
    } catch (err: any) {
      showToast(err?.message || 'Delete failed', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleStageFile = async (file: File) => {
    setStagedFile(file)
    setRunError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', clientId)
      formData.append('documentId', 'real_estate_appraisal')
      formData.append('uploaderEmail', getAdminEmail())
      const res = await fetch('/api/client-documents/upload', {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        await loadPortalDocs()
        if (onRefreshDocuments) void onRefreshDocuments()
      }
    } catch {
      // Best-effort background sync
    }
  }

  const runAnalysis = async () => {
    if (running) return
    setRunning(true)
    setRunError('')

    try {
      let fileToAnalyze: File | null = stagedFile

      if (!fileToAnalyze && portalDocs.length > 0) {
        const topDoc = portalDocs[0]
        fileToAnalyze = await fetchClientDocumentFile({
          clientId,
          documentId: topDoc.documentId,
          recordId: topDoc.id,
          fileName: topDoc.fileName,
          mimeType: topDoc.mimeType,
        })
      }

      if (!fileToAnalyze) {
        // Fallback to legacy raw document if available
        const raw = await fetch(
          '/api/client-documents/raw?clientId=' +
            encodeURIComponent(clientId) +
            '&documentId=real_estate_appraisal',
        )
        if (raw.ok) {
          const blob = await raw.blob()
          fileToAnalyze = new File([blob], 'appraisal.pdf', { type: blob.type || 'application/pdf' })
        }
      }

      if (!fileToAnalyze) {
        throw new Error('Please upload an appraisal document first.')
      }

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
        reader.onerror = () => reject(reader.error || new Error('Could not read appraisal document'))
        reader.readAsDataURL(fileToAnalyze)
      })

      const response = await fetch('/api/real-estate-appraisal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          fileName: fileToAnalyze.name,
          mediaType: fileToAnalyze.type || 'application/pdf',
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
      setComposingNew(false)
      setStagedFile(null)
      showToast('Appraisal analysis generated successfully')
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Appraisal analysis failed.')
    } finally {
      setRunning(false)
    }
  }

  // Document status calculations
  const portalStatus = documentStatuses?.['real_estate_appraisal']
  const hasFiles = Boolean(stagedFile) || portalDocs.length > 0 || Boolean(portalStatus?.fileName)
  const isUnavailable = !hasFiles && (portalStatus?.hasDoc === false || Boolean(portalStatus?.notApplicable))
  const canRun = hasFiles && !running

  const activeFileName =
    stagedFile?.name ||
    portalDocs[0]?.fileName ||
    portalStatus?.fileName ||
    'Appraisal Report'

  const readOnlyGate = agentTabReadOnlyGate(
    readOnly,
    loading,
    Boolean(report?.markdown),
    'Real Estate Appraisal',
  )
  if (readOnlyGate) return readOnlyGate

  const hasExistingReport = Boolean(report?.markdown) || historyItems.length > 0
  const showReport = Boolean(report?.markdown) && !composingNew

  // Editable report payload
  const reportTimestamps = (report as { updatedAt?: string | Date } | null) ?? null
  const updatedAtRaw = reportTimestamps?.updatedAt
  const editableReport = report?.markdown
    ? {
        markdown: report.markdown,
        generatedAt:
          typeof report.createdAt === 'string'
            ? report.createdAt
            : report.createdAt
              ? new Date(report.createdAt as string | Date).toISOString()
              : undefined,
        updatedAt:
          typeof updatedAtRaw === 'string'
            ? updatedAtRaw
            : updatedAtRaw
              ? new Date(updatedAtRaw).toISOString()
              : undefined,
      }
    : null

  return (
    <div className="space-y-6">
      {!readOnly && (
        <AgentRunToolbar
          provider={provider}
          onProviderChange={setProvider}
          disabled={running || deleting}
          historyItems={historyItems}
          activeId={activeId}
          onSelectRun={(run) => {
            setComposingNew(false)
            setActiveId(run.id)
          }}
          activeProvider={report?.aiProvider}
          activeModel={report?.aiModel}
        />
      )}

      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            {showReport
              ? 'Real Estate Appraisal Report'
              : composingNew
                ? 'Real Estate Appraisal Analysis'
                : 'Real Estate Appraisal Analysis'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {showReport
              ? `Commercial property valuation, market comparables, and real estate assessment for ${clientName}`
              : `Review and analyze commercial real estate appraisal documentation for ${clientName}`}
          </p>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2 shrink-0">
            {showReport && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200 cursor-pointer"
                  onClick={() => {
                    setComposingNew(true)
                    setRunError('')
                  }}
                  data-advisor-action
                >
                  <Plus className="w-3.5 h-3.5 text-slate-500" /> New Analysis
                </Button>
                {report && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-slate-200 cursor-pointer"
                    onClick={() => setDeleteOpen(true)}
                    data-advisor-action
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                )}
                <ExportReportButton
                  html={reportHtml(report.markdown, clientName)}
                  fileName={`real-estate-appraisal-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
                  label="Export Appraisal Report"
                />
              </>
            )}
            {historyItems.length > 0 && composingNew && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setComposingNew(false)}
                className="h-8 text-xs font-medium text-slate-700 border-slate-200 cursor-pointer"
              >
                Cancel
              </Button>
            )}
          </div>
        )}
      </div>

      {/* When running without report */}
      {running && !showReport && (
        <Card className="p-12 border-slate-200 shadow-sm bg-white">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-10 h-10 border-3 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-900 tracking-tight">Analyzing Real Estate Appraisal...</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Processing appraisal documentation and running market valuation synthesis.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Uploader View */}
      {(!showReport || composingNew) && !running && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
          {/* Sector Header: Required Appraisal Document */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Required Appraisal Document
                </h4>
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                    canRun
                      ? 'bg-emerald-100 text-emerald-800'
                      : isUnavailable
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800',
                  )}
                >
                  {canRun ? '1 document ready' : '0 of 1 ready'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  void loadPortalDocs()
                  if (onRefreshDocuments) void onRefreshDocuments()
                }}
                disabled={loadingPortalDocs}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={cn('w-3 h-3', loadingPortalDocs && 'animate-spin')} />
                Refresh
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Upload commercial real estate appraisal report, broker price opinion (BPO), or property valuation assessment for {clientName}.
            </p>
          </div>

          {/* Valuation-style Document Card Row */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragOver(false)
              const file = e.dataTransfer.files?.[0]
              if (file) void handleStageFile(file)
            }}
            className={cn(
              'p-4 rounded-xl border transition-all shadow-2xs',
              isDragOver
                ? 'border-amber-400 bg-amber-50/50'
                : canRun
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : 'border-slate-200/80 bg-white hover:border-slate-300',
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                    canRun
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-slate-100 text-slate-400',
                  )}
                >
                  <FileText className="w-4.5 h-4.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">Commercial Real Estate Appraisal</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                      Required
                    </span>

                    {canRun ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 1 Ready
                      </span>
                    ) : isUnavailable ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                        Not available with client
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                        Missing
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Formal certified appraisal, building inspection valuation, or county tax assessor valuation report.
                  </p>

                  {/* Queued / Uploaded File Chips */}
                  {hasFiles ? (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-emerald-200 text-emerald-900 shadow-2xs">
                        <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate max-w-[280px]" title={activeFileName}>
                          {activeFileName}
                        </span>
                        {stagedFile && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({formatBytes(stagedFile.size)})
                          </span>
                        )}
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-semibold">
                          Ready
                        </span>
                        {!readOnly && stagedFile && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setStagedFile(null)
                            }}
                            className="text-slate-400 hover:text-rose-600 ml-1 transition-colors cursor-pointer"
                            title="Remove from analysis"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-2 italic">
                      No appraisal file attached yet. Drag &amp; drop a PDF/image here or click Upload.
                    </p>
                  )}
                </div>
              </div>

              {/* Upload Button */}
              {!readOnly && (
                <div className="shrink-0 pt-0.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleStageFile(file)
                      e.target.value = ''
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={running}
                    className="gap-1.5 h-8 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-500" />
                    {hasFiles ? 'Replace file' : 'Upload appraisal'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Run Error */}
          {runError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{runError}</span>
            </div>
          )}

          {/* Bottom Readiness & Action Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-xs">
              {canRun ? (
                <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Appraisal document ready ({activeFileName}). You can run appraisal analysis.
                </span>
              ) : (
                <span className="text-amber-800 font-medium flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  Upload a commercial appraisal report (PDF or image) to run analysis.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {stagedFile && !readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStagedFile(null)}
                  disabled={running}
                  className="h-8 text-xs text-slate-600 hover:text-rose-600 cursor-pointer"
                >
                  Clear
                </Button>
              )}
              {composingNew && historyItems.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setComposingNew(false)}
                  disabled={running}
                  className="h-8 text-xs text-slate-700 cursor-pointer"
                >
                  Cancel
                </Button>
              )}
              {!readOnly && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void runAnalysis()}
                  disabled={!canRun || running}
                  className={cn(
                    'gap-1.5 h-8 text-xs font-medium cursor-pointer',
                    canRun && !running
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed',
                  )}
                >
                  {running ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {report ? 'Run Analysis Again' : 'Run Appraisal Analysis'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report View */}
      {showReport && editableReport && (
        <div className="space-y-6">
          <InlineEditableMarkdownReport
            report={editableReport}
            markdownComponents={markdownComponents}
            onSave={handleSaveMarkdown}
            readOnly={readOnly}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirmed}
      />

      {/* Status Toast */}
      {toast && (
        <StatusToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}

