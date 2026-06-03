'use client'

import { ExternalLink, Trash2, Loader2 } from 'lucide-react'
import type { ClientUploadedFile } from '@/lib/client-document-upload'

type AdminDocumentFileListProps = {
  clientId: string
  files: ClientUploadedFile[]
  onDeleteFile?: (file: ClientUploadedFile) => Promise<void>
  deletingId?: string | null
}

export function AdminDocumentFileList({
  clientId,
  files,
  onDeleteFile,
  deletingId,
}: AdminDocumentFileListProps) {
  if (!files.length) {
    return <p className="text-xs text-slate-400">No files uploaded yet.</p>
  }

  return (
    <ul className="space-y-1.5">
      {files.map(file => (
        <li
          key={file.id}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
        >
          <a
            href={`/api/client-documents/view?clientId=${encodeURIComponent(clientId)}&recordId=${encodeURIComponent(file.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 hover:text-emerald-700 underline underline-offset-2"
          >
            {file.fileName}
          </a>
          <span className="text-[10px] text-slate-400 shrink-0">
            {new Date(file.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <a
            href={`/api/client-documents/view?clientId=${encodeURIComponent(clientId)}&recordId=${encodeURIComponent(file.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 hover:text-slate-800"
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </a>
          {onDeleteFile && (
            <button
              type="button"
              onClick={() => void onDeleteFile(file)}
              disabled={deletingId === file.id}
              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-slate-500 hover:text-rose-600 disabled:opacity-50"
            >
              {deletingId === file.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Remove
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
