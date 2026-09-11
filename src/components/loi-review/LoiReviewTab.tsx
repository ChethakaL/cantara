'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText,
  Loader2,
  Upload,
  X,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Play,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import { Button, cn } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import InlineEditableMarkdownReport from '@/components/report-export/InlineEditableMarkdownReport'
import { buildLoiReviewReportHtml } from '@/lib/report-export/build-loi-review-report'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import type { AgentTabReadOnlyProps } from '@/types/agent-tab'

interface Props extends AgentTabReadOnlyProps {
  clientId: string
  clientName: string
}

type LoiReport = {
  clientName: string
  generatedAt: string
  updatedAt?: string
  markdown: string
  inputs?: {
    documentNames?: string[]
  }
}

type UploadedFile = {
  file: File
  name: string
  sizeBytes: number
}

// ── Status Toast ─────────────────────────────────────────────────────────────
function StatusToast({
  message,
  type = 'success',
  onClose,
}: {
  message: string
  type?: 'success' | 'error'
  onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div
        className={cn(
          'flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium',
          type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800',
        )}
      >
        {type === 'success' ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        ) : (
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
        )}
        <span>{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Delete Confirmation Modal ───────────────────────────────────────────────
function DeleteConfirmModal({
  open,
  title,
  description,
  onClose,
  onConfirm,
  confirmLabel = 'Delete',
  isDeleting = false,
}: {
  open: boolean
  title: string
  description: string
  onClose: () => void
  onConfirm: () => void
  confirmLabel?: string
  isDeleting?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
        </div>
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="px-3.5 py-2 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-5 border-b-2 border-amber-200 pb-3 text-2xl font-bold tracking-tight text-slate-900 font-serif">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-3 mt-10 text-lg font-bold tracking-tight text-slate-900 border-b border-slate-200 pb-2">
      {children}
    </h2>
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
    <ul className="mb-5 list-disc space-y-2 pl-5 text-sm text-slate-700 marker:text-amber-500">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-slate-700 marker:text-amber-500">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-7">{children}</li>
  ),
  hr: () => <hr className="my-8 border-slate-200" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-slate-50">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100/70">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-t border-slate-100 px-4 py-3 align-top text-sm leading-6 text-slate-700">
      {children}
    </td>
  ),
}

export default function LoiReviewTab({
  clientId,
  clientName,
  readOnly = false,
}: Props) {
  const [report, setReport] = useState<LoiReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [composingNew, setComposingNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const { provider, setProvider } = useAgentAiProvider()
  const {
    runs,
    historyItems,
    activeRun,
    activeId,
    setActiveId,
    reload: reloadRuns,
    loading: loadingRuns,
  } = useGenericAgentRuns(clientId, AGENT_RUN_KEYS.loiReview)

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (loadingRuns) return
    if (activeRun?.report) {
      setReport(activeRun.report as LoiReport)
    }
    setLoading(false)
  }, [activeRun, loadingRuns])

  function selectRun(run: AgentRunHistoryItem) {
    setActiveId(run.id)
    const full = runs.find((item) => item.id === run.id)
    if (full?.report) {
      setReport(full.report as LoiReport)
      setComposingNew(false)
    }
  }

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles: UploadedFile[] = Array.from(fileList).map(file => ({
      file,
      name: file.name,
      sizeBytes: file.size,
    }))
    setUploadedFiles(prev => [...prev, ...newFiles])
    setError(null)
  }, [])

  const removeFile = (name: string) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== name))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }, [handleFiles])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const analyze = async () => {
    if (uploadedFiles.length === 0) {
      setError('Please upload at least one Letter of Intent (LOI) document.')
      return
    }
    setGenerating(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('clientId', clientId)
      formData.append('clientName', clientName)

      for (const uploaded of uploadedFiles) {
        formData.append('files', uploaded.file)
      }
      formData.append('provider', provider)
      formData.append('modelId', resolveAgentModelId(provider))

      const res = await fetch('/api/loi-review', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setReport(data.report)
      setUploadedFiles([])
      setComposingNew(false)
      setToastMessage({ text: 'LOI comparative analysis generated successfully.', type: 'success' })

      await saveAgentAnalysisRunClient({
        clientId,
        agentKey: AGENT_RUN_KEYS.loiReview,
        fileName: `${clientName} — LOI Review`,
        report: data.report,
        markdown: data.report?.markdown,
        documentNames: data.report?.inputs?.documentNames,
        aiProvider: provider,
        aiModel: resolveAgentModelId(provider),
      })
      await reloadRuns({ selectNewest: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate LOI review.')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/loi-review?clientId=${clientId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete report')
      setReport(null)
      setShowDeleteModal(false)
      setComposingNew(false)
      setToastMessage({ text: 'LOI review report deleted.', type: 'success' })
      await reloadRuns()
    } catch (err: any) {
      setError(err.message || 'Failed to delete report')
    } finally {
      setIsDeleting(false)
    }
  }

  const html = useMemo(() =>
    report ? buildLoiReviewReportHtml(report) : '',
  [report])

  const readOnlyGate = agentTabReadOnlyGate(readOnly, loading || loadingRuns, Boolean(report), 'LOI Review & Comparison')
  if (readOnlyGate) return readOnlyGate

  if (loading || loadingRuns) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  const runToolbar = (
    <AgentRunToolbar
      provider={provider}
      onProviderChange={setProvider}
      disabled={generating}
      historyItems={historyItems}
      activeId={activeId}
      onSelectRun={selectRun}
      activeProvider={activeRun?.aiProvider}
      activeModel={activeRun?.aiModel}
      activeVersion={activeRun?.version}
    />
  )

  // ── Generating loading state ──────────────────────────────────────────────
  if (generating) {
    return (
      <div className="space-y-6">
        {runToolbar}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
          <div>
            <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
              LOI Review &amp; Comparison
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Analyze and compare buyer Letters of Intent for {clientName}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-2xs flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          </div>
          <div className="space-y-1">
            <h4 className="text-base font-semibold text-slate-900">Analyzing Letters of Intent...</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Evaluating each LOI across deal dimensions, comparing cash at close vs. seller financing, and building side-by-side matrices...
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Report view (when report exists and not composing new) ────────────────
  if (report && !composingNew) {
    return (
      <div className="space-y-6">
        {toastMessage && (
          <StatusToast
            message={toastMessage.text}
            type={toastMessage.type}
            onClose={() => setToastMessage(null)}
          />
        )}

        <DeleteConfirmModal
          open={showDeleteModal}
          title="Delete LOI Review Report?"
          description="This will remove the current comparative report. Uploaded documents and run history will remain accessible."
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          confirmLabel="Delete Report"
          isDeleting={isDeleting}
        />

        {runToolbar}

        {/* Serif Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
              LOI Review &amp; Comparison Report
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {clientName} &mdash; Generated {new Date(report.generatedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap" data-advisor-action>
            {!readOnly && (
              <button
                onClick={() => {
                  setUploadedFiles([])
                  setComposingNew(true)
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>+ New Analysis</span>
              </button>
            )}
            <ExportReportButton
              html={html}
              fileName={`loi-review-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
              label="Export LOI Report"
            />
            {!readOnly && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Report"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <InlineEditableMarkdownReport
          report={report}
          markdownComponents={markdownComponents}
          onSave={async (markdown) => {
            const res = await fetch('/api/loi-review', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clientId, markdown }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to save LOI review.')
            setReport(data.report)
            setToastMessage({ text: 'LOI review updated and saved.', type: 'success' })
          }}
        />
      </div>
    )
  }

  // ── Starting Workspace / Upload View (Org Chart UI Consistent) ─────────────
  const isReady = uploadedFiles.length > 0

  return (
    <div className="space-y-6">
      {toastMessage && (
        <StatusToast
          message={toastMessage.text}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}

      {runToolbar}

      {/* Serif Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            LOI Review &amp; Comparison
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Analyze and compare buyer Letters of Intent for {clientName}
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sector: REQUIRED LOI DOCUMENTS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Required LOI Documents
            </h3>
            <span
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                isReady
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              )}
            >
              {isReady ? `${uploadedFiles.length} document(s) ready` : '0 of 1 ready'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setUploadedFiles(prev => [...prev])}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
        <p className="text-xs text-slate-400 -mt-1">
          Upload received Letters of Intent (LOIs) for comparative analysis across key deal terms.
        </p>

        {/* Card Row */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'rounded-xl border transition-all p-4 space-y-3',
            isDragging
              ? 'border-amber-400 bg-amber-50/40 ring-2 ring-amber-400/20'
              : isReady
                ? 'border-slate-200 bg-white hover:border-slate-300'
                : 'border-dashed border-slate-300 bg-slate-50/50 hover:border-slate-400'
          )}
        >
          {/* Card Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                  isReady
                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                )}
              >
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold text-slate-800">
                    Letters of Intent (LOIs)
                  </h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    Required
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                      isReady
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    )}
                  >
                    {isReady ? `Uploaded (${uploadedFiles.length} ready)` : 'Missing'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Supported formats: PDF, DOCX.
                </p>
              </div>
            </div>

            {/* Action button */}
            <div className="flex-shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={generating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>{isReady ? '+ Add More LOIs' : '+ Upload LOI'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx"
                className="hidden"
                onChange={e => e.target.files && handleFiles(e.target.files)}
              />
            </div>
          </div>

          {/* Staged files chips */}
          {uploadedFiles.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <div className="grid gap-2">
                {uploadedFiles.map(f => (
                  <div
                    key={f.name}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/40 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span className="font-medium text-slate-800 truncate" title={f.name}>
                        {f.name}
                      </span>
                      <span className="text-[10px] text-slate-500 flex-shrink-0">
                        ({f.sizeBytes > 1024 * 1024
                          ? `${(f.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
                          : `${(f.sizeBytes / 1024).toFixed(0)} KB`})
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex-shrink-0">
                        Ready for Analysis
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(f.name)}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-white/60 transition-colors"
                      title="Remove file"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Readiness Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
        <div className="flex items-center gap-2 text-xs">
          {isReady ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="font-medium text-slate-700">
                {uploadedFiles.length} LOI document(s) ready. You can run LOI comparative analysis.
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-slate-500">
                Upload or select an LOI document to run analysis.
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end">
          {isReady && (
            <button
              type="button"
              onClick={() => setUploadedFiles([])}
              disabled={generating}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              Clear
            </button>
          )}
          {report && (
            <button
              type="button"
              onClick={() => setComposingNew(false)}
              disabled={generating}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={analyze}
            disabled={!isReady || generating}
            className={cn(
              'inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all shadow-sm',
              isReady && !generating
                ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            )}
          >
            {generating ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-400/30 border-t-slate-600 rounded-full animate-spin" />
                <span>Analyzing LOIs...</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Run LOI Analysis</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
