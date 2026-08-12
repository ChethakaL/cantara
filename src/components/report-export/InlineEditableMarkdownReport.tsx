'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button, Card, cn } from '@/components/ui'
import { parseMarkdownBlocks, serializeMarkdownBlocks, type MarkdownBlock } from '@/lib/markdown-blocks'
import { EditableTextBlock } from '@/components/report-export/EditableTextBlock'
import { isStatusCell } from '@/lib/report-export/status-cell'

type MarkdownReport = {
  markdown: string
  generatedAt?: string
  updatedAt?: string
}

function isChecklistCell(text: string): boolean {
  const value = String(text ?? '').trim()
  return value === '☐' || value === '☑'
}

function StatusSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const options = ['🟢 Green', '🟡 Yellow', '🔴 Red']
  const normalized = options.includes(value) ? value : options[0]
  return (
    <select
      value={normalized}
      onChange={event => onChange(event.target.value)}
      className="w-full rounded-lg border border-emerald-200 bg-white px-2 py-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-100"
    >
      {options.map(option => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  )
}

function ChecklistSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      value={String(value ?? '').trim() === '☑' ? '☑' : '☐'}
      onChange={event => onChange(event.target.value)}
      className="w-full rounded-lg border border-emerald-200 bg-white px-2 py-2 text-center text-xs outline-none focus:ring-2 focus:ring-emerald-100"
    >
      <option value="☐">Not done</option>
      <option value="☑">Done</option>
    </select>
  )
}

function EditableTableBlock({
  block,
  onChange,
}: {
  block: Extract<MarkdownBlock, { type: 'table' }>
  onChange: (next: Extract<MarkdownBlock, { type: 'table' }>) => void
}) {
  const updateHeader = (index: number, value: string) => {
    const headers = [...block.headers]
    headers[index] = value
    onChange({ ...block, headers })
  }

  const updateCell = (rowIndex: number, cellIndex: number, value: string) => {
    const rows = block.rows.map((row, index) => {
      if (index !== rowIndex) return row
      const next = [...row]
      next[cellIndex] = value
      return next
    })
    onChange({ ...block, rows })
  }

  const addRow = () => {
    onChange({ ...block, rows: [...block.rows, block.headers.map(() => '')] })
  }

  const removeRow = (rowIndex: number) => {
    onChange({ ...block, rows: block.rows.filter((_, index) => index !== rowIndex) })
  }

  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-emerald-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {block.headers.map((header, index) => (
              <th key={`${header}-${index}`} className="px-3 py-2 align-top">
                <input
                  value={header}
                  onChange={event => updateHeader(index, event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-600 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                />
              </th>
            ))}
            <th className="w-10 px-2" />
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-slate-100 align-top">
              {block.headers.map((_, cellIndex) => {
                const value = row[cellIndex] ?? ''
                return (
                  <td key={cellIndex} className="px-3 py-2">
                    {isStatusCell(value) ? (
                      <StatusSelect value={value} onChange={next => updateCell(rowIndex, cellIndex, next)} />
                    ) : isChecklistCell(value) ? (
                      <ChecklistSelect value={value} onChange={next => updateCell(rowIndex, cellIndex, next)} />
                    ) : (
                      <textarea
                        value={value}
                        onChange={event => updateCell(rowIndex, cellIndex, event.target.value)}
                        rows={Math.max(2, value.split('\n').length)}
                        className="w-full min-h-[44px] resize-y rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm leading-6 text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                      />
                    )}
                  </td>
                )
              })}
              <td className="px-2 py-2">
                <button
                  type="button"
                  onClick={() => removeRow(rowIndex)}
                  className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  title="Remove row"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-slate-100 px-3 py-2">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add row
        </button>
      </div>
    </div>
  )
}

export default function InlineEditableMarkdownReport({
  report,
  markdownComponents,
  onSave,
  readOnly = false,
}: {
  report: MarkdownReport
  markdownComponents: Record<string, React.ComponentType<any>>
  onSave: (markdown: string) => Promise<void>
  readOnly?: boolean
}) {
  const [editMode, setEditMode] = useState(false)
  const [blocks, setBlocks] = useState<MarkdownBlock[]>(() => parseMarkdownBlocks(report.markdown))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef(report.markdown)
  const effectiveEditMode = editMode && !readOnly

  useEffect(() => {
    if (!effectiveEditMode) {
      setBlocks(parseMarkdownBlocks(report.markdown))
      lastSavedRef.current = report.markdown
    }
  }, [report.markdown, effectiveEditMode])

  const draftMarkdown = useMemo(() => serializeMarkdownBlocks(blocks), [blocks])

  useEffect(() => {
    if (!effectiveEditMode || draftMarkdown === lastSavedRef.current) return
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setAutoSaveStatus('saving')
        await onSave(draftMarkdown)
        lastSavedRef.current = draftMarkdown
        setAutoSaveStatus('saved')
        setTimeout(() => setAutoSaveStatus(prev => (prev === 'saved' ? 'idle' : prev)), 2000)
      } catch {
        setAutoSaveStatus('error')
      }
    }, 1500)
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    }
  }, [draftMarkdown, effectiveEditMode, onSave])

  useEffect(() => {
    const flush = () => {
      if (!effectiveEditMode || draftMarkdown === lastSavedRef.current) return
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
      onSave(draftMarkdown)
        .then(() => {
          lastSavedRef.current = draftMarkdown
        })
        .catch(() => {})
    }

    document.addEventListener('visibilitychange', flush)
    window.addEventListener('beforeunload', flush)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('beforeunload', flush)
    }
  }, [draftMarkdown, effectiveEditMode, onSave])

  const lastSavedLabel = useMemo(() => {
    const stamp = report.updatedAt || report.generatedAt
    return stamp ? new Date(stamp).toLocaleString() : '—'
  }, [report.generatedAt, report.updatedAt])

  const updateBlock = (index: number, next: MarkdownBlock) => {
    setBlocks(current => current.map((block, blockIndex) => (blockIndex === index ? next : block)))
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(draftMarkdown)
      lastSavedRef.current = draftMarkdown
      setEditMode(false)
      setAutoSaveStatus('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save report.')
    } finally {
      setSaving(false)
    }
  }

  const cancelEditing = () => {
    setBlocks(parseMarkdownBlocks(report.markdown))
    setEditMode(false)
    setAutoSaveStatus('idle')
    setError(null)
  }

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Last updated {lastSavedLabel}
          </p>
          {editMode && autoSaveStatus === 'saving' && (
            <span className="text-[10px] font-medium text-slate-400 animate-pulse">Saving...</span>
          )}
          {editMode && autoSaveStatus === 'saved' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-500">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && (effectiveEditMode ? (
            <>
              <Button size="sm" variant="outline" onClick={cancelEditing} disabled={saving}>
                <X className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
                <Save className="h-3.5 w-3.5" /> {saving ? 'Saving…' : 'Save Final Version'}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit Output
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="p-6">
        {effectiveEditMode ? (
          <div className="space-y-4">
            <p className="text-[11px] text-slate-500">
              Edit directly in the report below. Tables can be changed cell by cell — add or remove rows as needed.
            </p>
            {blocks.map((block, index) => (
              <div key={index}>
                {block.type === 'table' ? (
                  <EditableTableBlock block={block} onChange={next => updateBlock(index, next)} />
                ) : (
                  <EditableTextBlock content={block.content} onChange={content => updateBlock(index, { type: 'text', content })} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {report.markdown}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </Card>
  )
}
