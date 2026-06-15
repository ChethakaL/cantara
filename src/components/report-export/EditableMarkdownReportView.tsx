'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Pencil, Save, X, Check } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button, Card, cn } from '@/components/ui'

type MarkdownReport = {
  markdown: string
  generatedAt?: string
  updatedAt?: string
}

export default function EditableMarkdownReportView({
  report,
  accentClassName = 'border-amber-200',
  markdownComponents,
  onSave,
}: {
  report: MarkdownReport
  accentClassName?: string
  markdownComponents: Record<string, React.ComponentType<any>>
  onSave: (markdown: string) => Promise<void>
}) {
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState(report.markdown)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef(report.markdown)

  useEffect(() => {
    if (!editMode) {
      setDraft(report.markdown)
      lastSavedRef.current = report.markdown
    }
  }, [report.markdown, editMode])

  // Autosave with 1500ms debounce when editing
  useEffect(() => {
    if (!editMode || draft === lastSavedRef.current) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setAutoSaveStatus('saving')
        await onSave(draft)
        lastSavedRef.current = draft
        setAutoSaveStatus('saved')
        setTimeout(() => setAutoSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 2000)
      } catch {
        setAutoSaveStatus('error')
      }
    }, 1500)
    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current) }
  }, [draft, editMode])

  // Flush on visibility change (tab switch / close)
  useEffect(() => {
    const flush = () => {
      if (editMode && draft !== lastSavedRef.current) {
        onSave(draft).then(() => { lastSavedRef.current = draft }).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('beforeunload', flush)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('beforeunload', flush)
    }
  }, [editMode, draft])

  const lastSavedLabel = useMemo(() => {
    const stamp = report.updatedAt || report.generatedAt
    return stamp ? new Date(stamp).toLocaleString() : '—'
  }, [report.generatedAt, report.updatedAt])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(draft)
      lastSavedRef.current = draft
      setEditMode(false)
      setAutoSaveStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save report.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Last updated {lastSavedLabel}
          </div>
          {editMode && autoSaveStatus === 'saving' && (
            <span className="text-[10px] font-medium text-slate-400 animate-pulse">Saving...</span>
          )}
          {editMode && autoSaveStatus === 'saved' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-500">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => { setEditMode(false); setDraft(report.markdown); setAutoSaveStatus('idle') }}>
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
              <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
                <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save & close'}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
              <Pencil className="w-3.5 h-3.5" /> Edit report
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {editMode ? (
        <textarea
          value={draft}
          onChange={event => setDraft(event.target.value)}
          className={cn(
            'min-h-[480px] w-full rounded-xl border bg-white px-4 py-3 font-mono text-sm leading-6 text-slate-800 focus:outline-none focus:ring-2',
            accentClassName,
          )}
        />
      ) : (
        <div className="max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {report.markdown}
          </ReactMarkdown>
        </div>
      )}
    </Card>
  )
}
