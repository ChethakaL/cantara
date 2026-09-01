'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
import { Button } from '@/components/ui'
import { formatDocumentUploadAcceptAttribute, validateDocumentUpload } from '@/lib/client-document-upload'

export function ClientDocumentUpload({
  clientId,
  documentId,
  uploaderEmail,
  currentFileName,
  onUploaded,
  label,
  variant = 'dropzone',
}: {
  clientId: string
  documentId: string
  uploaderEmail: string
  currentFileName?: string | null
  onUploaded: (result: { fileName: string; fileUrl?: string | null; uploadedAt: string }) => void | Promise<void>
  label?: string
  variant?: 'dropzone' | 'button'
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [displayName, setDisplayName] = useState(currentFileName ?? '')
  const inputRef = useRef<HTMLInputElement>(null)
  const accept = formatDocumentUploadAcceptAttribute(documentId)

  useEffect(() => {
    setDisplayName(currentFileName ?? '')
  }, [currentFileName])

  const uploadFile = async (file: File) => {
    if (!file || !uploaderEmail) return
    const validationError = validateDocumentUpload(documentId, file)
    if (validationError) {
      setError(validationError)
      return
    }
    setUploading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('clientId', clientId)
      form.append('documentId', documentId)
      form.append('uploaderEmail', uploaderEmail)
      const res = await fetch('/api/client-documents/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Upload failed')
      }
      const data = (await res.json()) as { fileName: string; fileUrl?: string | null; uploadedAt?: string }
      const fileName = data.fileName || file.name
      setDisplayName(fileName)
      await onUploaded({
        fileName,
        fileUrl: data.fileUrl ?? null,
        uploadedAt: data.uploadedAt ?? new Date().toISOString(),
      })
    } finally {
      setUploading(false)
    }
  }

  const uploadLabel = label ?? (displayName ? 'Add another file' : 'Upload for client')

  if (variant === 'button') {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) void uploadFile(file)
            e.target.value = ''
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={uploading || !uploaderEmail}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? 'Uploading…' : uploadLabel}
        </Button>
        {error && <p className="w-full text-xs text-rose-600">{error}</p>}
      </>
    )
  }

  return (
    <div className="space-y-2">
    <label
      className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs transition-all ${
        uploading
          ? 'border-amber-300 bg-amber-50 text-amber-700'
          : displayName
            ? 'border-emerald-200 bg-emerald-50/80 text-emerald-800'
            : 'border-slate-200 text-slate-500 hover:border-amber-300 hover:bg-amber-50/50 hover:text-amber-700'
      } ${uploading ? 'cursor-wait' : ''}`}
    >
      <input
        type="file"
        className="hidden"
        accept={accept}
        disabled={uploading || !uploaderEmail}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) void uploadFile(file)
          e.target.value = ''
        }}
      />
      {uploading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Upload className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate font-medium">{uploading ? 'Uploading…' : uploadLabel}</span>
    </label>
    {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  )
}
