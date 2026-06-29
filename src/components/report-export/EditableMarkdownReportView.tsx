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
  const [activeSectionIndex, setActiveSectionIndex] = useState(0)
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

  const sections = useMemo(() => splitMarkdownSections(draft), [draft])
  const activeSection = sections[Math.min(activeSectionIndex, Math.max(0, sections.length - 1))] ?? sections[0]
  const updateSection = (index: number, nextContent: string) => {
    const nextSections = [...sections]
    nextSections[index] = { ...nextSections[index], content: nextContent }
    setDraft(joinMarkdownSections(nextSections))
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
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Report Sections</p>
            <div className="space-y-1">
              {sections.map((section, index) => (
                <button
                  key={`${section.title}-${index}`}
                  type="button"
                  onClick={() => setActiveSectionIndex(index)}
                  className={cn(
                    'w-full rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-colors',
                    index === activeSectionIndex
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-white hover:text-slate-900',
                  )}
                >
                  <span className="block truncate">{section.title}</span>
                  <span className={cn('mt-0.5 block text-[10px] font-medium', index === activeSectionIndex ? 'text-white/50' : 'text-slate-400')}>
                    {section.content.split(/\s+/).filter(Boolean).length} words
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Editing: {activeSection?.title ?? 'Report'}
              </label>
              <textarea
                value={activeSection?.content ?? draft}
                onChange={event => activeSection ? updateSection(activeSectionIndex, event.target.value) : setDraft(event.target.value)}
                className={cn(
                  'min-h-[520px] w-full rounded-xl border bg-white px-4 py-3 font-mono text-sm leading-6 text-slate-800 focus:outline-none focus:ring-2',
                  accentClassName,
                )}
              />
              <p className="mt-2 text-[11px] text-slate-400">
                Changes auto-save after a short pause. Use the section list instead of editing the whole document at once.
              </p>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Preview</p>
              <div className="max-h-[560px] overflow-auto rounded-xl border border-slate-200 bg-white p-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {activeSection ? `${activeSection.headingPrefix}${activeSection.title}\n\n${activeSection.content}` : draft}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
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

type MarkdownSection = {
  title: string
  headingPrefix: string
  content: string
}

export function splitMarkdownSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split('\n')
  const sections: MarkdownSection[] = []
  let current: MarkdownSection | null = null
  const intro: string[] = []

  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)$/)
    if (match && match[1].length <= 2) {
      if (current) sections.push(current)
      else if (intro.some(item => item.trim())) {
        sections.push({ title: 'Opening', headingPrefix: '', content: intro.join('\n').trim() })
      }
      current = { title: match[2].trim(), headingPrefix: `${match[1]} `, content: '' }
      continue
    }
    if (current) current.content = current.content ? `${current.content}\n${line}` : line
    else intro.push(line)
  }

  if (current) sections.push(current)
  else sections.push({ title: 'Report', headingPrefix: '', content: markdown })

  return sections.map(section => ({ ...section, content: section.content.trim() }))
}

export function joinMarkdownSections(sections: MarkdownSection[]) {
  return sections
    .map(section => `${section.headingPrefix}${section.headingPrefix ? section.title : ''}${section.headingPrefix ? '\n\n' : ''}${section.content}`.trim())
    .filter(Boolean)
    .join('\n\n')
}
