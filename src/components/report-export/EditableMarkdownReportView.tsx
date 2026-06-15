'use client'

import { useEffect, useMemo, useState } from 'react'
import { Pencil, Save, X } from 'lucide-react'
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

  useEffect(() => {
    if (!editMode) setDraft(report.markdown)
  }, [report.markdown, editMode])

  const lastSavedLabel = useMemo(() => {
    const stamp = report.updatedAt || report.generatedAt
    return stamp ? new Date(stamp).toLocaleString() : '—'
  }, [report.generatedAt, report.updatedAt])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(draft)
      setEditMode(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save report.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Last updated {lastSavedLabel}
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => { setEditMode(false); setDraft(report.markdown) }}>
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
              <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
                <Save className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save edits'}
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
