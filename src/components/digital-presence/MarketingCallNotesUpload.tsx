'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { getAdminEmail } from '@/lib/store'

type UploadedNote = { id: string; fileName: string; mimeType?: string; uploadedAt: string }

export default function MarketingCallNotesUpload({ clientId }: { clientId: string }) {
  const [notes, setNotes] = useState<UploadedNote[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewText, setPreviewText] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadNotes = useCallback(async () => {
    try {
      const response = await fetch(`/api/client-documents?clientId=${encodeURIComponent(clientId)}&documentId=marketing_call_notes&all=true`, { cache: 'no-store' })
      if (!response.ok) throw new Error(await response.text() || 'Could not load call notes.')
      const data = await response.json()
      const documents = Array.isArray(data.documents) ? data.documents as UploadedNote[] : []
      setNotes(documents)
      setPreviewId(current => current && documents.some(note => note.id === current) ? current : null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load call notes.')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { void loadNotes() }, [loadNotes])

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      setError('Marketing call notes must be 15 MB or smaller.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('clientId', clientId)
      body.append('documentId', 'marketing_call_notes')
      body.append('uploaderEmail', getAdminEmail())
      const response = await fetch('/api/client-documents/upload', { method: 'POST', body })
      if (!response.ok) throw new Error(await response.text() || 'Upload failed.')
      const uploaded = await response.json()
      setPreviewId(uploaded.id ?? null)
      setPreviewText('')
      // Match Facility Review: extract the original File before relying on its
      // stored copy for preview. This also makes the automatically opened
      // preview useful immediately after upload (previously it opened empty).
      setPreviewLoading(true)
      try {
        const notesForm = new FormData()
        notesForm.append('file', file)
        const extractResponse = await fetch('/api/facility-review/extract-notes', {
          method: 'POST',
          body: notesForm,
        })
        if (!extractResponse.ok) {
          const detail = await extractResponse.text()
          throw new Error(detail || 'Could not extract text from the uploaded notes.')
        }
        const extracted = await extractResponse.json() as { text?: unknown }
        const text = typeof extracted.text === 'string' ? extracted.text.trim() : ''
        if (!text) throw new Error('No readable text was found in this document.')
        setPreviewText(text)
        console.info('[Marketing Agent] Uploaded call notes extracted for preview', {
          fileName: file.name,
          chars: text.length,
        })
      } catch (previewCause) {
        console.error('[Marketing Agent] Uploaded call notes preview extraction failed', {
          fileName: file.name,
          error: previewCause,
        })
        setError(`Uploaded ${file.name}, but could not preview its text. ${previewCause instanceof Error ? previewCause.message : 'Try another PDF, DOCX, or TXT file.'}`)
      } finally {
        setPreviewLoading(false)
      }
      await loadNotes()
    } catch (cause) {
      console.error('[Marketing Agent] Call notes upload failed', cause)
      setError(cause instanceof Error ? cause.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const remove = async (note: UploadedNote) => {
    setDeletingId(note.id)
    setError(null)
    try {
      const response = await fetch('/api/client-documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, recordId: note.id }),
      })
      if (!response.ok) throw new Error(await response.text() || 'Could not remove this file.')
      setNotes(current => current.filter(item => item.id !== note.id))
      if (previewId === note.id) {
        setPreviewId(null)
        setPreviewText('')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove this file.')
    } finally {
      setDeletingId(null)
    }
  }

  const togglePreview = async (note: UploadedNote) => {
    if (previewId === note.id) {
      setPreviewId(null)
      return
    }
    setPreviewId(note.id)
    setPreviewText('')
    if (/\.pdf$/i.test(note.fileName)) return
    setPreviewLoading(true)
    setError(null)
    try {
      const query = new URLSearchParams({ clientId, recordId: note.id })
      const response = await fetch(`/api/digital-presence/marketing-call-notes/preview?${query}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(await response.text() || 'Could not preview this document.')
      const data = await response.json()
      setPreviewText(typeof data.text === 'string' ? data.text : '')
    } catch (cause) {
      console.error('[Marketing Agent] Call notes preview failed', {
        fileName: note.fileName,
        error: cause,
      })
      setError(cause instanceof Error ? cause.message : 'Could not preview this document.')
    } finally {
      setPreviewLoading(false)
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3" aria-label="Marketing call notes">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 rounded-lg bg-amber-50 p-2 text-amber-700"><FileText className="h-4 w-4" /></span>
          <div>
            <h4 className="text-xs font-semibold text-slate-800">Advisor call notes</h4>
            <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-slate-500">Upload notes or a transcript if the client did not complete the marketing questions, or to add context. The analysis will use these together with any saved form answers.</p>
          </div>
        </div>
        <label className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? 'Uploading…' : 'Upload notes'}
          <input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="sr-only" onChange={upload} disabled={uploading} />
        </label>
      </div>
      {loading && <p className="mt-2 text-[11px] text-slate-400">Checking uploaded notes…</p>}
      {!loading && notes.length > 0 && <ul className="mt-3 space-y-1.5">{notes.map(note => (
        <li key={note.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md bg-slate-50 px-2.5 py-2">
          <span className="min-w-0 truncate text-[11px] text-slate-700">{note.fileName}<span className="ml-2 text-slate-400">{new Date(note.uploadedAt).toLocaleDateString()}</span></span>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => void togglePreview(note)} aria-expanded={previewId === note.id} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-100">{previewId === note.id ? 'Close preview' : 'Preview'}</button>
            <button type="button" onClick={() => void remove(note)} disabled={deletingId === note.id} aria-label={`Remove ${note.fileName}`} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50">
              {deletingId === note.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
          {previewId === note.id && <div className="col-span-2 min-w-0 border-t border-slate-200 pt-2">
            {/\.pdf$/i.test(note.fileName) ? (
              <iframe title={`Preview of ${note.fileName}`} src={`/api/client-documents/view?clientId=${encodeURIComponent(clientId)}&recordId=${encodeURIComponent(note.id)}`} className="h-[420px] w-full rounded-md border border-slate-200 bg-white" />
            ) : previewLoading ? (
              <div className="flex items-center gap-2 py-6 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Extracting document text…</div>
            ) : (
              <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-white p-3 text-[11px] leading-relaxed text-slate-700">{previewText || 'No readable text was found in this document.'}</pre>
            )}
          </div>}
        </li>
      ))}</ul>}
      {error && <p role="alert" className="mt-2 text-[11px] text-rose-600">{error}</p>}
    </section>
  )
}
