'use client'

import { useRef, useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload,
  FileText,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Play,
  Plus,
} from 'lucide-react'
import { Button, cn } from '@/components/ui'
import type { ContractDocument } from '../../lib/contract-analysis/types'
import type { ClientUploadedDoc } from '@/lib/client-documents-client'
import { isPdfFileName } from '@/lib/client-documents-client'
import { getAdminEmail, type DocumentStatus } from '@/lib/store'
import { AgentModelProviderSelect } from '@/components/admin/AgentModelProviderSelect'
import type { AgentAiProvider } from '@/lib/agent-model-provider'

interface Props {
  clientId?: string
  documents: ContractDocument[]
  addDocuments: (files: File[]) => Promise<void> | void
  removeDocument: (index: number) => void
  status: string
  onAnalyze: () => void
  provider?: AgentAiProvider
  onProviderChange?: (provider: AgentAiProvider) => void
  uploadedFromDocuments?: ClientUploadedDoc[]
  documentStatus?: DocumentStatus
  onRefreshDocuments?: () => Promise<void> | void
  loadingPortalDocs?: boolean
  onUseUploadedDocument?: (doc: ClientUploadedDoc) => void
  loadingUploadedId?: string | null
  onCancel?: () => void
  error?: string | null
  readOnly?: boolean
  showProviderSelect?: boolean
}

export function ContractUploader({
  clientId,
  documents,
  addDocuments,
  removeDocument,
  status,
  onAnalyze,
  provider,
  onProviderChange,
  uploadedFromDocuments = [],
  documentStatus,
  onRefreshDocuments,
  loadingPortalDocs = false,
  onUseUploadedDocument,
  loadingUploadedId = null,
  onCancel,
  error,
  readOnly = false,
  showProviderSelect = false,
}: Props) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 KB'
    const k = 1024
    if (bytes < k * k) return `${(bytes / k).toFixed(0)} KB`
    return `${(bytes / (k * k)).toFixed(1)} MB`
  }

  const busy = (status !== 'idle' && status !== 'error') || isUploading
  const queuedNames = new Set(documents.map((doc) => doc.name))
  const unaddedPortalDocs = uploadedFromDocuments.filter((doc) => !queuedNames.has(doc.fileName))

  const totalCount = documents.length
  const hasFiles =
    totalCount > 0 ||
    uploadedFromDocuments.length > 0 ||
    Boolean(documentStatus?.fileName) ||
    documentStatus?.hasDoc === true
  const isUnavailable =
    !hasFiles &&
    (documentStatus?.hasDoc === false || Boolean(documentStatus?.notApplicable))
  const canRun = totalCount > 0

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return
    setIsUploading(true)
    try {
      await addDocuments(files)

      // Persist to portal documents store if clientId is provided
      if (clientId) {
        for (const file of files) {
          try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('clientId', clientId)
            formData.append('documentId', 'material_contracts')
            formData.append('uploaderEmail', getAdminEmail())
            await fetch('/api/client-documents/upload', {
              method: 'POST',
              body: formData,
            })
          } catch (uploadErr) {
            console.warn('Background portal contract upload notice:', uploadErr)
          }
        }
      }

      if (onRefreshDocuments) {
        void onRefreshDocuments()
      }
    } finally {
      setIsUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => void handleFiles(files),
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    disabled: busy || readOnly,
    noClick: true,
  })

  const handleAddAllPortalDocs = async () => {
    if (!onUseUploadedDocument) return
    for (const doc of unaddedPortalDocs) {
      if (isPdfFileName(doc.fileName)) {
        await onUseUploadedDocument(doc)
      }
    }
  }

  return (
    <div className="space-y-4">
      {showProviderSelect && provider && onProviderChange && (
        <AgentModelProviderSelect
          value={provider}
          onChange={onProviderChange}
          disabled={busy}
        />
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
        {/* Sector Header: Required Contract Documents */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Required Contract Documents
              </h4>
              <span
                className={cn(
                  'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                  canRun
                    ? 'bg-emerald-100 text-emerald-800'
                    : hasFiles
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800',
                )}
              >
                {canRun
                  ? `${totalCount} document${totalCount > 1 ? 's' : ''} ready`
                  : '0 of 1 ready'}
              </span>
            </div>
            {onRefreshDocuments && (
              <button
                type="button"
                onClick={() => void onRefreshDocuments()}
                disabled={loadingPortalDocs}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('w-3 h-3', loadingPortalDocs && 'animate-spin')} />
                Refresh
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Upload formal contract agreements (PDF) for vendor, supplier, software, and commercial customer agreements exceeding $5,000/year or longer than 12 months.
          </p>

          {/* Valuation-style Document Card Row */}
          <div
            {...getRootProps()}
            className={cn(
              'p-4 rounded-xl border transition-all shadow-2xs',
              isDragActive
                ? 'border-amber-400 bg-amber-50/50'
                : canRun
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : hasFiles
                    ? 'border-amber-200/90 bg-amber-50/20'
                    : 'border-slate-200/80 bg-white hover:border-slate-300',
            )}
          >
            <input {...getInputProps()} />
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                      canRun
                        ? 'bg-emerald-50 text-emerald-600'
                        : hasFiles
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-slate-100 text-slate-400',
                    )}
                  >
                    <FileText className="w-4.5 h-4.5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800">Vendor & Material Contracts</p>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                        Required
                      </span>

                      {canRun ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {totalCount} Ready
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
                      Agreements with key suppliers, software/SaaS vendors, equipment leases, and service providers. Multiple PDFs supported.
                    </p>

                    {/* Queued / Uploaded File Chips */}
                    {documents.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2.5">
                        {documents.map((doc, idx) => {
                          const isFromPortal = uploadedFromDocuments.some((p) => p.fileName === doc.name)
                          const portalDoc = uploadedFromDocuments.find((p) => p.fileName === doc.name)

                          return (
                            <div
                              key={doc.name || idx}
                              className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border shadow-2xs',
                                isFromPortal ? 'border-emerald-200 text-emerald-900' : 'border-slate-200 text-slate-800',
                              )}
                            >
                              <FileText className={cn('w-3.5 h-3.5 shrink-0', isFromPortal ? 'text-emerald-600' : 'text-slate-500')} />
                              {portalDoc && clientId ? (
                                <a
                                  href={`/api/client-documents/view?clientId=${encodeURIComponent(clientId)}&documentId=material_contracts&recordId=${encodeURIComponent(portalDoc.id)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="truncate max-w-[220px] hover:underline"
                                  title="Click to view file in new tab"
                                >
                                  {doc.name}
                                </a>
                              ) : (
                                <span className="truncate max-w-[220px]" title={doc.name}>
                                  {doc.name}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({formatSize(doc.sizeBytes)})
                              </span>
                              {isFromPortal && (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-semibold">
                                  Portal
                                </span>
                              )}
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    removeDocument(idx)
                                  }}
                                  className="text-slate-400 hover:text-rose-600 ml-1 transition-colors"
                                  title="Remove from analysis"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Unadded Portal Documents Section */}
                    {unaddedPortalDocs.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-100">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            Available in Client Portal ({unaddedPortalDocs.length})
                          </p>
                          {unaddedPortalDocs.length > 1 && !readOnly && onUseUploadedDocument && (
                            <button
                              type="button"
                              onClick={handleAddAllPortalDocs}
                              disabled={busy}
                              className="text-[10px] font-semibold text-amber-700 hover:text-amber-800 transition-colors"
                            >
                              + Add All to Analysis
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {unaddedPortalDocs.map((doc) => {
                            const isPdf = isPdfFileName(doc.fileName)
                            const loading = loadingUploadedId === doc.id

                            return (
                              <div
                                key={doc.id}
                                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs bg-slate-50 border border-slate-200 text-slate-700"
                              >
                                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[200px]" title={doc.fileName}>
                                  {doc.fileName}
                                </span>
                                {doc.uploadedAt && (
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(doc.uploadedAt).toLocaleDateString()}
                                  </span>
                                )}
                                {!readOnly && isPdf && onUseUploadedDocument && (
                                  <button
                                    type="button"
                                    onClick={() => onUseUploadedDocument(doc)}
                                    disabled={busy || loading}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition-colors disabled:opacity-50"
                                  >
                                    {loading ? (
                                      <>
                                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Adding...
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-2.5 h-2.5" /> Add
                                      </>
                                    )}
                                  </button>
                                )}
                                {!isPdf && <span className="text-[10px] text-slate-400">PDF only</span>}
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
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        void handleFiles(Array.from(e.target.files))
                      }
                      e.target.value = ''
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                    className="gap-1.5 h-8 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-500" />
                    {documents.length > 0 ? 'Add more files' : 'Upload contract(s)'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Alert */}
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
                Contracts ready ({totalCount} document{totalCount > 1 ? 's' : ''}). You can run contract analysis.
              </span>
            ) : (
              <span className="text-amber-800 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                Upload required material contract documents to run analysis.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {documents.length > 0 && !readOnly && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  for (let i = documents.length - 1; i >= 0; i--) {
                    removeDocument(i)
                  }
                }}
                disabled={busy}
                className="h-8 text-xs text-slate-600 hover:text-rose-600"
              >
                Clear All
              </Button>
            )}
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancel}
                disabled={busy}
                className="h-8 text-xs text-slate-700"
              >
                Cancel
              </Button>
            )}
            {!readOnly && (
              <Button
                type="button"
                size="sm"
                onClick={onAnalyze}
                disabled={!canRun || busy}
                className={cn(
                  'gap-1.5 h-8 text-xs font-medium',
                  canRun && !busy
                    ? 'bg-slate-900 text-white hover:bg-slate-800'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed',
                )}
              >
                {busy ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Run Contract Analysis
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

