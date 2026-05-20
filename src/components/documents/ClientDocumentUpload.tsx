'use client'

import { useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { CheckCircle, Loader2, Upload } from 'lucide-react'

export function ClientDocumentUpload({
  clientId,
  documentId,
  uploaderEmail,
  currentFileName,
  onUploaded,
  label,
}: {
  clientId: string
  documentId: string
  uploaderEmail: string
  currentFileName?: string | null
  onUploaded: (result: { fileName: string; fileUrl?: string | null; uploadedAt: string }) => void | Promise<void>
  label?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [displayName, setDisplayName] = useState(currentFileName ?? '')

  useEffect(() => {
    setDisplayName(currentFileName ?? '')
  }, [currentFileName])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (files) => {
      if (!files[0] || !uploaderEmail) return
      setUploading(true)
      try {
        const form = new FormData()
        form.append('file', files[0])
        form.append('clientId', clientId)
        form.append('documentId', documentId)
        form.append('uploaderEmail', uploaderEmail)
        const res = await fetch('/api/client-documents/upload', { method: 'POST', body: form })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(text || 'Upload failed')
        }
        const data = (await res.json()) as { fileName: string; fileUrl?: string | null; uploadedAt?: string }
        const fileName = data.fileName || files[0].name
        setDisplayName(fileName)
        await onUploaded({
          fileName,
          fileUrl: data.fileUrl ?? null,
          uploadedAt: data.uploadedAt ?? new Date().toISOString(),
        })
      } finally {
        setUploading(false)
      }
    },
    multiple: false,
  })

  const uploadLabel = label ?? (displayName ? 'Replace file' : 'Upload file')

  return (
    <div
      {...getRootProps()}
      className={`border border-dashed rounded-lg px-3 py-2 cursor-pointer text-xs transition-all flex items-center gap-2 min-w-[132px] ${
        uploading
          ? 'border-amber-300 bg-amber-50 text-amber-700'
          : displayName
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : isDragActive
              ? 'border-amber-400 bg-amber-50 text-amber-600'
              : 'border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-500'
      }`}
    >
      <input {...getInputProps()} />
      {uploading ? (
        <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
      ) : displayName ? (
        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
      ) : (
        <Upload className="w-3.5 h-3.5 shrink-0" />
      )}
      <span className="truncate">
        {uploading ? 'Uploading...' : isDragActive ? 'Drop file here' : uploadLabel}
      </span>
    </div>
  )
}
