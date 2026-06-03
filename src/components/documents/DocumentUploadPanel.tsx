'use client'

import { useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { ExternalLink, FileText, Loader2, Plus, Trash2 } from 'lucide-react'
import { buildDocumentUploadStatusSummary, type ClientUploadedFile } from '@/lib/client-document-upload'

export type DocumentUploadStatusSummary = ReturnType<typeof buildDocumentUploadStatusSummary>

type DocumentUploadPanelProps = {
  clientId: string
  uploadDocumentId: string
  uploaderEmail: string
  files: ClientUploadedFile[]
  onFilesChange: (files: ClientUploadedFile[]) => void
  onStatusChange?: (summary: DocumentUploadStatusSummary) => void
  onAfterMutation?: () => Promise<void>
}

export function DocumentUploadPanel({
  clientId,
  uploadDocumentId,
  uploaderEmail,
  files,
  onFilesChange,
  onStatusChange,
  onAfterMutation,
}: DocumentUploadPanelProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    onStatusChange?.(buildDocumentUploadStatusSummary(files))
  }, [files, onStatusChange])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    disabled: uploading || !uploaderEmail,
    multiple: true,
    onDrop: async accepted => {
      if (!accepted.length || !uploaderEmail) return
      setUploading(true)
      setError('')
      setUploadProgress(`Uploading 0 of ${accepted.length}…`)
      let succeeded = 0
      try {
        for (let index = 0; index < accepted.length; index++) {
          const file = accepted[index]
          setUploadProgress(`Uploading ${index + 1} of ${accepted.length}…`)
          const form = new FormData()
          form.append('file', file)
          form.append('clientId', clientId)
          form.append('documentId', uploadDocumentId)
          form.append('uploaderEmail', uploaderEmail)
          const res = await fetch('/api/client-documents/upload', { method: 'POST', body: form })
          if (!res.ok) {
            const text = await res.text().catch(() => '')
            throw new Error(text || `Failed to upload ${file.name}`)
          }
          succeeded += 1
        }
        await onAfterMutation?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.')
        if (succeeded > 0) await onAfterMutation?.()
      } finally {
        setUploading(false)
        setUploadProgress(null)
      }
    },
  })

  const removeFile = async (file: ClientUploadedFile) => {
    const confirmed = window.confirm(`Remove "${file.fileName}"?`)
    if (!confirmed) return
    setDeletingId(file.id)
    setError('')
    try {
      const res = await fetch('/api/client-documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, recordId: file.id }),
      })
      if (!res.ok) throw new Error(await res.text())
      onFilesChange(files.filter(item => item.id !== file.id))
      await onAfterMutation?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove file.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {files.length > 0 && (
        <ul className="space-y-1.5 rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
          {files.map(file => (
            <li key={file.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-slate-800">{file.fileName}</p>
                <p className="text-[10px] text-slate-400">
                  {new Date(file.uploadedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <a
                href={`/api/client-documents/view?clientId=${encodeURIComponent(clientId)}&recordId=${encodeURIComponent(file.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-slate-600 hover:text-slate-900"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" />
                View
              </a>
              <button
                type="button"
                onClick={() => void removeFile(file)}
                disabled={deletingId === file.id}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-slate-500 hover:text-rose-600 disabled:opacity-50"
              >
                {deletingId === file.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        {...getRootProps()}
        className={`flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs transition-colors ${
          uploading
            ? 'cursor-wait border-amber-300 bg-amber-50 text-amber-800'
            : isDragActive
              ? 'cursor-pointer border-amber-400 bg-amber-50 text-amber-800'
              : 'cursor-pointer border-slate-300 bg-white text-slate-600 hover:border-amber-400 hover:bg-amber-50/40'
        }`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        <span className="font-medium">
          {uploading
            ? uploadProgress ?? 'Uploading…'
            : isDragActive
              ? 'Drop files here'
              : files.length
                ? 'Add another file or files'
                : 'Upload a file or files'}
        </span>
      </div>

      <p className="text-[10px] text-slate-400 leading-relaxed">
        You can upload one or more files. New uploads are added — they never replace existing files.
      </p>

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  )
}
