'use client'

import { useRef, useState } from 'react'
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
} from 'lucide-react'
import { Button, cn } from '@/components/ui'
import type { LeaseDocument } from '../../lib/lease-analysis/types'
import type { ClientUploadedDoc } from '@/lib/client-documents-client'
import { getAdminEmail, type DocumentStatus } from '@/lib/store'

import { AgentModelProviderSelect } from '@/components/admin/AgentModelProviderSelect'
import type { AgentAiProvider } from '@/lib/agent-model-provider'

interface Props {
  clientId?: string
  documents: LeaseDocument[]
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
  isPreparing?: boolean
  onCancel?: () => void
  error?: string | null
  readOnly?: boolean
}

export function LeaseUploader({
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
  isPreparing = false,
  onCancel,
  error,
  readOnly = false,
}: Props) {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Deduplicate local docs that share the same filename with a portal doc
  const uniqueLocalDocs = documents.filter(
    (localDoc) => !uploadedFromDocuments.some((pDoc) => pDoc.fileName === localDoc.name),
  )

  const totalCount = uploadedFromDocuments.length + uniqueLocalDocs.length
  const hasFiles =
    totalCount > 0 ||
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
            formData.append('documentId', 'leases')
            formData.append('uploaderEmail', getAdminEmail())
            await fetch('/api/client-documents/upload', {
              method: 'POST',
              body: formData,
            })
          } catch (uploadErr) {
            console.warn('Background portal lease upload notice:', uploadErr)
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
    disabled: (status !== 'idle' && status !== 'error') || isPreparing || readOnly,
    noClick: true,
  })

  return (
    <div className="space-y-4">
      {provider && onProviderChange && (
        <AgentModelProviderSelect
          value={provider}
          onChange={onProviderChange}
          disabled={status !== 'idle' && status !== 'error'}
        />
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
      {/* Sector Header: Required Lease Document */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Required Lease Document
            </h4>
            <span
              className={cn(
                'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                hasFiles ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
              )}
            >
              {hasFiles
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
          Commercial lease agreement(s) and all amendments, extensions, riders, and addenda. Upload one or multiple documents (PDF).
        </p>

        {/* Valuation-style Document Card Row */}
        <div
          {...getRootProps()}
          className={cn(
            'p-4 rounded-xl border transition-all',
            isDragActive
              ? 'border-amber-400 bg-amber-50/50'
              : hasFiles
                ? 'border-slate-200 bg-white hover:border-slate-300'
                : 'border-slate-200 bg-slate-50/50 hover:border-amber-200 hover:bg-amber-50/20',
          )}
        >
          <input {...getInputProps()} />
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                    hasFiles
                      ? 'bg-emerald-50 text-emerald-600'
                      : isUnavailable
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-slate-100 text-slate-400',
                  )}
                >
                  <FileText className="w-4.5 h-4.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">Lease(s) + All Addendums</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                      Required
                    </span>

                    {hasFiles ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> {totalCount} Uploaded
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
                    Commercial lease agreement(s) and all amendments, extensions, riders, and addenda. Multiple PDFs supported.
                  </p>

                  {/* Uploaded file chips */}
                  {hasFiles && (uploadedFromDocuments.length > 0 || uniqueLocalDocs.length > 0) && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      {/* Client portal documents */}
                      {uploadedFromDocuments.map((file, idx) => (
                        <a
                          key={file.id || idx}
                          href={`/api/client-documents/view?clientId=${encodeURIComponent(clientId)}&documentId=leases&recordId=${encodeURIComponent(file.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-emerald-200 text-emerald-900 shadow-2xs hover:bg-emerald-50 transition-colors"
                          title="Click to view file in new tab"
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[240px] font-medium">{file.fileName}</span>
                          {file.uploadedAt && (
                            <span className="text-[10px] text-slate-400 font-normal">
                              · {new Date(file.uploadedAt).toLocaleDateString()}
                            </span>
                          )}
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-semibold">
                            Active
                          </span>
                        </a>
                      ))}

                      {/* Locally added documents in current session */}
                      {uniqueLocalDocs.map((doc, idx) => (
                        <div
                          key={`local-${idx}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-amber-200 text-slate-800 shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate max-w-[220px] font-medium">{doc.name}</span>
                          <span className="text-[10px] text-slate-400">· {formatSize(doc.sizeBytes)}</span>
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-semibold">
                            Local
                          </span>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                const origIdx = documents.findIndex((d) => d.name === doc.name)
                                if (origIdx >= 0) removeDocument(origIdx)
                              }}
                              className="text-slate-400 hover:text-rose-500 transition-colors ml-0.5"
                              title="Remove file"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action button */}
            {!readOnly && (
              <div className="shrink-0 pt-0.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    if (files.length > 0) void handleFiles(files)
                    e.target.value = ''
                  }}
                  disabled={isUploading || (status !== 'idle' && status !== 'error') || isPreparing}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || (status !== 'idle' && status !== 'error') || isPreparing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      {hasFiles ? 'Add Lease PDF' : 'Upload Files'}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bottom Footer */}
      <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-xs">
          {canRun ? (
            <span className="text-emerald-700 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              {totalCount} lease document{totalCount > 1 ? 's' : ''} ready. You can run the lease analysis.
            </span>
          ) : (
            <span className="text-amber-800 font-medium flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              Upload at least one commercial lease document to run analysis.
            </span>
          )}
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {onCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCancel}
                className="h-8 text-xs font-medium text-slate-700"
              >
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              onClick={onAnalyze}
              disabled={!canRun || (status !== 'idle' && status !== 'error') || isPreparing}
              className="gap-1.5 h-8 text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isPreparing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Preparing Documents…
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Run Lease Analysis
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  </div>
  )
}
