'use client'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Pencil, Check, X } from 'lucide-react'
import { ContractReport, FindingSection } from '../../../lib/contract-analysis/types'
import { Badge, Button } from '@/components/ui'

interface Props {
  findings: FindingSection[]
  raw: string
  report?: ContractReport
  adminMode?: boolean
  onReportUpdated?: (report: ContractReport) => Promise<void>
  editMode?: boolean
  onReportDraftChange?: (report: ContractReport) => void
}

type FindingDraft = {
  riskTier: string
  keyTerms: Array<{ field: string; detail: string }>
  sections: Array<{ heading: string; body: string }>
}

function parseFindingContent(content: string): FindingDraft {
  const riskTier = content.match(/\*\*Risk Tier:\s*([^*]+)\*\*/i)?.[1]?.trim() || ''
  const keyTerms: Array<{ field: string; detail: string }> = []
  const tableMatch = content.match(/\|\s*Field\s*\|\s*Detail\s*\|[\s\S]*?(?=\n####|\n###|\n##|$)/i)
  if (tableMatch) {
    tableMatch[0]
      .split('\n')
      .filter(line => line.includes('|') && !/field\s*\|\s*detail/i.test(line) && !/^\s*\|?\s*-+/.test(line))
      .forEach(line => {
        const cells = line.split('|').map(cell => cell.trim()).filter(Boolean)
        if (cells.length >= 2) keyTerms.push({ field: cells[0], detail: cells.slice(1).join(' | ') })
      })
  }

  const withoutRisk = content.replace(/\*\*Risk Tier:[^\n]+\n?/i, '').replace(tableMatch?.[0] ?? '', '').trim()
  const parts = withoutRisk.split(/\n####\s+/).filter(Boolean)
  const sections = parts.length
    ? parts.map((part, index) => {
        const lines = part.trim().split('\n')
        const first = lines[0]?.trim() || `Section ${index + 1}`
        if (index === 0 && !content.includes('####')) return { heading: 'Notes', body: part.trim() }
        return { heading: first.replace(/^#+\s*/, ''), body: lines.slice(1).join('\n').trim() }
      })
    : [{ heading: 'Notes', body: '' }]

  return { riskTier, keyTerms, sections }
}

function serializeFindingContent(draft: FindingDraft): string {
  const risk = draft.riskTier ? `**Risk Tier: ${draft.riskTier}**\n\n` : ''
  const table = draft.keyTerms.length
    ? `#### KEY TERMS TABLE\n\n| Field | Detail |\n|---|---|\n${draft.keyTerms.map(row => `| ${row.field.replace(/\|/g, '/')} | ${row.detail.replace(/\|/g, '/')} |`).join('\n')}\n\n`
    : ''
  const sections = draft.sections
    .filter(section => section.heading.trim() || section.body.trim())
    .map(section => `#### ${section.heading.trim() || 'Section'}\n${section.body.trim()}`)
    .join('\n\n')
  return `${risk}${table}${sections}`.trim()
}

export function DetailedFindings({ findings, raw, report, adminMode = false, onReportUpdated, editMode = false, onReportDraftChange }: Props) {
  const [selected, setSelected] = useState(findings[0]?.id ?? '')
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const current = findings.find(f => f.id === selected)
  const currentIndex = findings.findIndex(f => f.id === selected)

  if (!findings.length) {
    const part2 = raw.match(/---START_PART2---([\s\S]*?)---END_PART2---/)?.[1] ?? raw
    return (
      <div className="prose prose-sm max-w-none text-slate-700 p-4 bg-slate-50 rounded-xl overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{part2}</ReactMarkdown>
      </div>
    )
  }

  const handleEditStart = () => {
    if (!current) return
    setEditContent(current.content)
    setEditing(true)
  }

  const updateDraftFinding = (updates: Partial<FindingSection>) => {
    if (!report || !onReportDraftChange || currentIndex < 0) return
    const nextFindings = findings.map((finding, index) => (
      index === currentIndex ? { ...finding, ...updates } : finding
    ))
    onReportDraftChange({ ...report, detailedFindings: nextFindings })
  }

  const updateDraftContent = (draft: FindingDraft) => {
    updateDraftFinding({ content: serializeFindingContent(draft) })
  }

  const handleEditCancel = () => {
    setEditing(false)
    setEditContent('')
  }

  const handleEditSave = async () => {
    if (!report || !onReportUpdated || !current) return
    setSaving(true)
    try {
      const updatedFindings = findings.map((f) =>
        f.id === current.id ? { ...f, content: editContent } : f,
      )
      const updatedReport: ContractReport = { ...report, detailedFindings: updatedFindings }
      await onReportUpdated(updatedReport)
      setEditing(false)
      setEditContent('')
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'Failed to save finding edits')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-320px)] min-h-[500px]">
      {/* Sidebar Navigation */}
      <div className="w-56 shrink-0 flex flex-col gap-1 overflow-y-auto pr-2 custom-scrollbar border-r border-slate-100">
        {findings.map(f => (
          <button
            key={f.id}
            onClick={() => { setSelected(f.id); setEditing(false) }}
            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-all border ${
              selected === f.id
                ? 'bg-amber-50 border-amber-200 text-amber-700 font-semibold shadow-sm'
                : 'text-slate-500 border-transparent hover:bg-slate-100/50 hover:text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 overflow-hidden">
                <span className={`font-mono px-1.5 py-0.5 rounded shrink-0 ${selected === f.id ? 'bg-amber-100' : 'bg-slate-100'}`}>{f.id}</span>
                <span className="truncate flex-1">{f.title}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        {current ? (
          <>
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
              <h5 className="font-semibold text-slate-800 tracking-tight">{current.id} — {current.title}</h5>
              <div className="flex items-center gap-2">
                {adminMode && onReportUpdated && !editMode && !editing && (
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleEditStart}>
                    <Pencil className="w-3 h-3" />
                    Edit
                  </Button>
                )}
                {editing && (
                  <>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled={saving} onClick={handleEditCancel}>
                      <X className="w-3 h-3" />
                      Cancel
                    </Button>
                    <Button size="sm" className="gap-1.5 text-xs" disabled={saving} onClick={handleEditSave}>
                      <Check className="w-3 h-3" />
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </>
                )}
                <Badge color="slate" className="text-[10px] uppercase tracking-wider text-slate-400 border-slate-200">Analysis Section</Badge>
              </div>
            </div>
            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
              {editMode && report && onReportDraftChange ? (
                <StructuredFindingEditor
                  finding={current}
                  onTitleChange={(title) => updateDraftFinding({ title })}
                  draft={parseFindingContent(current.content)}
                  onDraftChange={updateDraftContent}
                />
              ) : editing ? (
                <textarea
                  className="w-full h-full min-h-[400px] p-4 text-sm font-mono text-slate-700 bg-slate-50 border border-slate-200 rounded-xl resize-y focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                />
              ) : (
                <div className="prose prose-sm prose-slate max-w-none
                  prose-p:leading-relaxed
                  prose-headings:text-slate-800
                  prose-strong:text-slate-900
                  prose-table:border prose-table:border-slate-100
                  prose-th:bg-slate-50 prose-th:px-3 prose-th:py-2
                  prose-td:px-3 prose-td:py-2
                  prose-blockquote:border-l-amber-300 prose-blockquote:bg-amber-50/20 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
                  prose-code:text-amber-700 prose-code:bg-amber-50/50 prose-code:px-1 prose-code:rounded">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {current.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-4">
            <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center animate-pulse">
                <div className="w-8 h-8 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Processing Document...</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StructuredFindingEditor({
  finding,
  draft,
  onTitleChange,
  onDraftChange,
}: {
  finding: FindingSection
  draft: FindingDraft
  onTitleChange: (title: string) => void
  onDraftChange: (draft: FindingDraft) => void
}) {
  const updateTerm = (index: number, key: 'field' | 'detail', value: string) => {
    onDraftChange({
      ...draft,
      keyTerms: draft.keyTerms.map((term, i) => (i === index ? { ...term, [key]: value } : term)),
    })
  }
  const updateSection = (index: number, key: 'heading' | 'body', value: string) => {
    onDraftChange({
      ...draft,
      sections: draft.sections.map((section, i) => (i === index ? { ...section, [key]: value } : section)),
    })
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Contract finding title</p>
        <input
          value={finding.title}
          onChange={(event) => onTitleChange(event.target.value)}
          className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-100"
        />
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Risk tier</p>
        <select
          value={draft.riskTier}
          onChange={(event) => onDraftChange({ ...draft, riskTier: event.target.value })}
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-100"
        >
          <option value="">Not set</option>
          <option value="🔴 High">High</option>
          <option value="🟡 Medium">Medium</option>
          <option value="🟢 Low">Low</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Key terms</p>
          <button
            className="text-xs font-semibold text-amber-700 hover:text-amber-800"
            onClick={() => onDraftChange({ ...draft, keyTerms: [...draft.keyTerms, { field: '', detail: '' }] })}
          >
            + Add term
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {draft.keyTerms.map((term, index) => (
            <div key={index} className="grid grid-cols-1 gap-3 p-3 md:grid-cols-[220px_1fr_32px]">
              <input value={term.field} onChange={(event) => updateTerm(index, 'field', event.target.value)} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold" placeholder="Field" />
              <input value={term.detail} onChange={(event) => updateTerm(index, 'detail', event.target.value)} className="rounded-lg border border-amber-300 px-3 py-2 text-xs" placeholder="Detail" />
              <button className="text-red-400 hover:text-red-600" onClick={() => onDraftChange({ ...draft, keyTerms: draft.keyTerms.filter((_, i) => i !== index) })}>x</button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Narrative sections</p>
          <button
            className="text-xs font-semibold text-amber-700 hover:text-amber-800"
            onClick={() => onDraftChange({ ...draft, sections: [...draft.sections, { heading: 'New section', body: '' }] })}
          >
            + Add section
          </button>
        </div>
        {draft.sections.map((section, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <input
                value={section.heading}
                onChange={(event) => updateSection(index, 'heading', event.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold"
                placeholder="Section heading"
              />
              <button className="text-xs text-red-500 hover:text-red-700" onClick={() => onDraftChange({ ...draft, sections: draft.sections.filter((_, i) => i !== index) })}>Delete</button>
            </div>
            <textarea
              value={section.body}
              onChange={(event) => updateSection(index, 'body', event.target.value)}
              className="min-h-[110px] w-full rounded-lg border border-amber-300 px-3 py-2 text-sm leading-relaxed text-slate-700 outline-none focus:ring-2 focus:ring-amber-100"
              placeholder="Section text"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
