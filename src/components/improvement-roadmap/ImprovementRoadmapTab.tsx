'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw, MapPin, CheckCircle2, Circle, ClipboardCheck, ArrowRight, Plus, Trash2, Pencil, Save, X, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button, Card, cn } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import InlineEditableMarkdownReport from '@/components/report-export/InlineEditableMarkdownReport'
import { buildImprovementRoadmapHtml } from '@/lib/report-export/build-improvement-roadmap-report'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'
import { getStatusBadgeKind, isStatusCell } from '@/lib/report-export/status-cell'
import { createChecklistItem, exportSaleReadinessChecklistExcel, type SaleReadinessChecklistItem, type SaleReadinessRoadmapStage } from '@/lib/sale-readiness-checklist'
import { isFlagTitleLine, isItemApprovedInMarkdown, normalizeTitleKey, toggleItemApprovalInMarkdown } from '@/lib/roadmap-flag-items'

type RoadmapReport = {
  workstreamLabel: string
  clientName: string
  generatedAt: string
  updatedAt?: string
  markdown: string
  stage: SaleReadinessRoadmapStage
  checklist?: SaleReadinessChecklistItem[]
  sourceAgents?: string[]
}

function StatusBadge({ text }: { text: string }) {
  const kind = getStatusBadgeKind(text)
  if (kind === 'green') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">🟢 Green</span>
  }
  if (kind === 'yellow') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">🟡 Yellow</span>
  }
  if (kind === 'red') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-semibold text-rose-700">🔴 Red</span>
  }
  return <span>{String(text ?? '')}</span>
}

const STATUS_OPTIONS = ['🟢 GREEN', '🟡 YELLOW', '🔴 RED']

function normalizeStatus(value: string) {
  const upper = String(value ?? '').toUpperCase()
  if (upper.includes('RED') || value.includes('🔴')) return '🔴 RED'
  if (upper.includes('YELLOW') || value.includes('🟡')) return '🟡 YELLOW'
  if (upper.includes('GREEN') || value.includes('🟢')) return '🟢 GREEN'
  return STATUS_OPTIONS[0]
}

async function saveChecklistItems(clientId: string, items: SaleReadinessChecklistItem[]) {
  const res = await fetch('/api/sale-readiness-checklist', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, items }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Failed to save checklist.')
  return (data.checklist?.items ?? items) as SaleReadinessChecklistItem[]
}

function renderFormattedText(text: string | undefined): React.ReactNode {
  if (!text) return ''
  if (!text.includes('**') && !text.includes('__')) return text

  const parts = text.split(/(\*\*[^*]+?\*\*|__[^*]+?__)/g)
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return <strong key={index} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('__') && part.endsWith('__') && part.length >= 4) {
      return <strong key={index} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>
    }
    return part
  })
}

function ChecklistApprovalPanel({
  clientId,
  clientName,
  items,
  sourceAgents = [],
  disabled = false,
  onUpdated,
  onEditingChange,
}: {
  clientId: string
  clientName: string
  items: SaleReadinessChecklistItem[]
  sourceAgents?: string[]
  disabled?: boolean
  onUpdated: (items: SaleReadinessChecklistItem[]) => void
  onEditingChange?: (editing: boolean) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<SaleReadinessChecklistItem[]>(items)
  const [updating, setUpdating] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const rows = editing ? draft : items
  const approvedCount = rows.filter(item => item.advisorApproved).length

  const setEditingMode = (next: boolean) => {
    setEditing(next)
    onEditingChange?.(next)
  }

  const persist = async (nextItems: SaleReadinessChecklistItem[], updatingKey = 'save') => {
    setUpdating(updatingKey)
    setSaveError(null)
    try {
      const saved = await saveChecklistItems(clientId, nextItems)
      onUpdated(saved)
      return saved
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save checklist.')
      throw err
    } finally {
      setUpdating(null)
    }
  }

  const startEditing = () => {
    setDraft(items.map(item => ({ ...item })))
    setSaveError(null)
    setEditingMode(true)
  }

  const cancelEditing = () => {
    setDraft(items.map(item => ({ ...item })))
    setSaveError(null)
    setEditingMode(false)
  }

  const saveEdits = async () => {
    try {
      const saved = await persist(draft, 'save')
      setDraft(saved.map(item => ({ ...item })))
      setEditingMode(false)
    } catch {
      // Error is shown in the panel; stay in edit mode.
    }
  }

  const updateDraft = (itemId: string, patch: Partial<SaleReadinessChecklistItem>) => {
    setDraft(current => current.map(item => item.id === itemId ? { ...item, ...patch } : item))
  }

  const toggleApproved = async (item: SaleReadinessChecklistItem) => {
    const patch = {
      advisorApproved: !item.advisorApproved,
      approvedAt: !item.advisorApproved ? new Date().toISOString() : null,
      clientCompleted: !item.advisorApproved ? item.clientCompleted : false,
      clientCompletedAt: !item.advisorApproved ? item.clientCompletedAt : null,
    }
    if (editing) {
      updateDraft(item.id, patch)
      return
    }
    await persist(items.map(row => row.id === item.id ? { ...row, ...patch } : row), item.id)
  }

  const approveAll = async () => {
    const now = new Date().toISOString()
    const next = rows.map(item => ({ ...item, advisorApproved: true, approvedAt: now }))
    if (editing) {
      setDraft(next)
      return
    }
    await persist(next, 'all')
  }

  const addItem = () => {
    setDraft(current => [
      ...current,
      createChecklistItem({
        category: 'New category',
        item: 'New checklist item',
        status: '🟡 YELLOW',
        actionNeeded: '',
        advisorApproved: true,
        approvedAt: new Date().toISOString(),
      }),
    ])
  }

  return (
    <Card className="overflow-hidden border-emerald-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-emerald-50/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold text-slate-800">Advisor Checklist Review</p>
            <p className="text-[11px] text-slate-500">
              {editing
                ? 'Edit wording, add or remove items, then save before generating the report.'
                : 'Approve the items that should go into the full report. Click Edit to change wording or add items.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {editing ? (
            <>
              <button
                type="button"
                disabled={disabled || updating !== null}
                onClick={cancelEditing}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
              <button
                type="button"
                disabled={disabled || updating !== null}
                onClick={() => void saveEdits()}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
              >
                <Save className="h-3 w-3" />
                {updating === 'save' ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={disabled || updating !== null}
              onClick={startEditing}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
          {approvedCount < rows.length && (
            <button
              type="button"
              disabled={disabled || updating !== null}
              onClick={() => void approveAll()}
              className="text-[11px] font-semibold px-2.5 py-1 rounded-md border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
            >
              {updating === 'all' ? 'Approving...' : 'Approve All'}
            </button>
          )}
          {items.length > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => exportSaleReadinessChecklistExcel(items, clientName)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              title="Download Checklist as Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
              Export Excel
            </button>
          )}
          <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-semibold text-emerald-700">
            {approvedCount}/{rows.length} approved
          </span>
        </div>
      </div>
      {sourceAgents.length > 0 && (
        <div className="border-b border-slate-100 bg-white px-4 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Using completed agent outputs</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {sourceAgents.map(name => (
              <span key={name} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
      {saveError && (
        <div className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">{saveError}</div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Include</th>
              <th className="px-4 py-2 text-left font-semibold">Category</th>
              <th className="px-4 py-2 text-left font-semibold">Item</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
              {editing && <th className="w-10 px-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={editing ? 5 : 4} className="px-4 py-8 text-center text-sm text-slate-500">
                  {editing ? 'No checklist items yet. Add one to include it in the report.' : 'No checklist items yet. Click Edit to add items.'}
                </td>
              </tr>
            ) : rows.map(item => (
              <tr key={item.id} className="align-top">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={disabled || updating === item.id}
                    onClick={() => void toggleApproved(item)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                      item.advisorApproved
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {item.advisorApproved ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    {item.advisorApproved ? 'Approved' : 'Approve'}
                  </button>
                </td>
                {editing ? (
                  <>
                    <td className="px-4 py-3">
                      <input
                        value={item.category}
                        disabled={disabled}
                        onChange={event => updateDraft(item.id, { category: event.target.value })}
                        className="w-full min-w-[140px] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={item.item}
                        disabled={disabled}
                        onChange={event => updateDraft(item.id, { item: event.target.value })}
                        className="w-full min-w-[220px] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-800 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                      />
                      <textarea
                        value={item.actionNeeded}
                        disabled={disabled}
                        rows={2}
                        onChange={event => updateDraft(item.id, { actionNeeded: event.target.value })}
                        placeholder="Action needed"
                        className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs leading-5 text-slate-600 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={normalizeStatus(item.status)}
                        disabled={disabled}
                        onChange={event => updateDraft(item.id, { status: event.target.value })}
                        className="w-full min-w-[130px] rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50"
                      >
                        {STATUS_OPTIONS.map(option => (
                          <option key={option} value={option}>{option.replace('🟢 ', '').replace('🟡 ', '').replace('🔴 ', '')}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        disabled={disabled || updating !== null}
                        onClick={() => setDraft(current => current.filter(row => row.id !== item.id))}
                        className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        title="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">{renderFormattedText(item.category)}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-slate-800">{renderFormattedText(item.item)}</p>
                      {item.actionNeeded ? (
                        <p className="mt-1 text-xs leading-5 text-slate-500">{renderFormattedText(item.actionNeeded)}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3"><StatusBadge text={item.status} /></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="border-t border-slate-100 px-4 py-2.5">
          <button
            type="button"
            disabled={disabled || updating !== null}
            onClick={addItem}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add checklist item
          </button>
        </div>
      )}
    </Card>
  )
}

function getNodeText(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(getNodeText).join('')
  if (node && typeof node === 'object' && 'props' in node && (node as any).props?.children) {
    return getNodeText((node as any).props.children)
  }
  return ''
}

function FlagItemHeader({
  text,
  readOnly,
  onToggleApproval,
}: {
  text: string
  readOnly?: boolean
  onToggleApproval?: (titleKey: string) => Promise<void> | void
}) {
  const [toggling, setToggling] = useState(false)
  const isApproved = isItemApprovedInMarkdown(text)
  const titleKey = normalizeTitleKey(text)

  let flagBadgeText = '🔴 RED'
  let flagBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200'
  if (text.includes('🟡') || /YELLOW/i.test(text)) {
    flagBadgeText = '🟡 YELLOW'
    flagBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200'
  } else if (text.includes('🟢') || /GREEN/i.test(text)) {
    flagBadgeText = '🟢 GREEN'
    flagBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }

  const cleanTitle = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s*(?:🔴|🟡|🟢)\s*(?:RED|YELLOW|GREEN)?/gi, '')
    .replace(/^\*\*|\*\*$/g, '')
    .replace(/^#+\s*/, '')
    .trim()

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (toggling || !onToggleApproval) return
    setToggling(true)
    try {
      await onToggleApproval(titleKey)
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="my-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 shadow-sm">
      <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
        <span className="text-sm font-bold text-slate-900 leading-snug">{cleanTitle}</span>
        {flagBadgeText && (
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${flagBadgeColor}`}>
            {flagBadgeText}
          </span>
        )}
      </div>

      {!readOnly && onToggleApproval && (
        <button
          type="button"
          disabled={toggling}
          onClick={handleClick}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-sm',
            toggling && 'opacity-70 cursor-wait',
            isApproved
              ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 shadow-emerald-200'
              : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-500 hover:text-emerald-700 hover:bg-slate-50',
          )}
          title={isApproved ? 'Approved: Visible in client portal. Click to exclude.' : 'Excluded: Click to approve for client portal.'}
        >
          {toggling ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-current" />
              <span>Saving...</span>
            </>
          ) : isApproved ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-white" />
              Approved for Client Portal
            </>
          ) : (
            <>
              <Circle className="w-4 h-4 text-slate-400" />
              Approve for Client Portal
            </>
          )}
        </button>
      )}
    </div>
  )
}

function createRoadmapMarkdownComponents(options: {
  readOnly?: boolean
  onToggleApproval?: (titleKey: string) => void
}) {
  let isInsideFlagSection = false

  return {
    h1: ({ children }: { children?: React.ReactNode }) => {
      isInsideFlagSection = false
      return <h1 className="mb-5 border-b-2 border-emerald-200 pb-3 text-2xl font-bold tracking-tight text-slate-900">{children}</h1>
    },
    h2: ({ children }: { children?: React.ReactNode }) => {
      const text = getNodeText(children).toLowerCase()
      isInsideFlagSection = text.includes('red flag') || text.includes('yellow flag') || text.includes('green flag')
      return <h2 className="mb-3 mt-10 text-lg font-bold tracking-tight text-slate-900 border-b border-slate-200 pb-2">{children}</h2>
    },
    h3: ({ children }: { children?: React.ReactNode }) => {
      const text = getNodeText(children)
      if (isInsideFlagSection && isFlagTitleLine(text)) {
        return (
          <FlagItemHeader
            text={text}
            readOnly={options.readOnly}
            onToggleApproval={options.onToggleApproval}
          />
        )
      }
      return <h3 className="mb-2 mt-6 text-sm font-bold text-slate-800">{children}</h3>
    },
    h4: ({ children }: { children?: React.ReactNode }) => (
      <h4 className="mb-2 mt-4 text-sm font-semibold text-slate-700">{children}</h4>
    ),
    p: ({ children }: { children?: React.ReactNode }) => {
      const text = getNodeText(children)
      if (isInsideFlagSection && isFlagTitleLine(text)) {
        return (
          <FlagItemHeader
            text={text}
            readOnly={options.readOnly}
            onToggleApproval={options.onToggleApproval}
          />
        )
      }
      return <p className="mb-4 text-sm leading-7 text-slate-700">{children}</p>
    },
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-bold text-slate-900">{children}</strong>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="mb-5 list-disc space-y-2 pl-5 text-sm text-slate-700 marker:text-emerald-500">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-slate-700 marker:text-emerald-500">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="leading-7">{children}</li>
    ),
    hr: () => <hr className="my-8 border-slate-200" />,
    table: ({ children }: { children?: React.ReactNode }) => (
      <div className="my-6 overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }: { children?: React.ReactNode }) => (
      <thead className="bg-slate-50">{children}</thead>
    ),
    th: ({ children }: { children?: React.ReactNode }) => {
      const text = String(children ?? '')
      if (text.includes('🔴')) {
        return (
          <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-rose-600 bg-rose-50/50">
            <div className="flex flex-col items-center justify-center gap-0.5">
              <span className="text-[9px] font-bold tracking-wider text-slate-400">Items</span>
              <span className="inline-flex items-center gap-1">{children}</span>
            </div>
          </th>
        )
      }
      if (text.includes('🟡')) {
        return (
          <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50/50">
            <div className="flex flex-col items-center justify-center gap-0.5">
              <span className="text-[9px] font-bold tracking-wider text-slate-400">Items</span>
              <span className="inline-flex items-center gap-1">{children}</span>
            </div>
          </th>
        )
      }
      if (text.includes('🟢')) {
        return (
          <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-emerald-600 bg-emerald-50/50">
            <div className="flex flex-col items-center justify-center gap-0.5">
              <span className="text-[9px] font-bold tracking-wider text-slate-400">Items</span>
              <span className="inline-flex items-center gap-1">{children}</span>
            </div>
          </th>
        )
      }
      return <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">{children}</th>
    },
    td: ({ children }: { children?: React.ReactNode }) => {
      const text = String(children ?? '')
      if (isStatusCell(text)) {
        return <td className="border-t border-slate-100 px-4 py-3 align-top"><StatusBadge text={text} /></td>
      }
      if (text.trim() === '☐' || text.trim() === '☑') {
        return (
          <td className="border-t border-slate-100 px-4 py-3 align-top text-center">
            {text.trim() === '☑'
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
              : <Circle className="w-4 h-4 text-slate-300 inline" />
            }
          </td>
        )
      }
      return <td className="border-t border-slate-100 px-4 py-3 align-top text-sm leading-6 text-slate-700">{children}</td>
    },
  }
}

export default function ImprovementRoadmapTab({
  clientId,
  clientName,
  readOnly = false,
}: {
  clientId: string
  clientName: string
  readOnly?: boolean
}) {
  const [report, setReport] = useState<RoadmapReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<'checklist' | 'report' | null>(null)
  const [editingChecklist, setEditingChecklist] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { provider, setProvider } = useAgentAiProvider()
  const {
    runs,
    historyItems,
    activeRun,
    activeId,
    setActiveId,
    reload: reloadRuns,
    loading: loadingRuns,
  } = useGenericAgentRuns(clientId, AGENT_RUN_KEYS.salesReadinessRoadmap)

  const stage = report?.stage ?? 'checklist'
  const checklistItems = report?.checklist ?? []
  const checklistRef = useRef(checklistItems)
  checklistRef.current = checklistItems
  const approvedCount = checklistItems.filter(item => item.advisorApproved).length
  const hasChecklist = Boolean(report)
  const hasFullReport = stage === 'report' && Boolean(report?.markdown?.trim())

  const loadFromApi = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/improvement-roadmap?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setReport(data.report)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roadmap.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (loadingRuns) return
    if (activeRun?.report) {
      setReport(activeRun.report as RoadmapReport)
      setLoading(false)
      return
    }
    void loadFromApi()
  }, [activeRun, loadingRuns, clientId])

  function selectRun(run: AgentRunHistoryItem) {
    setActiveId(run.id)
    const full = runs.find((item) => item.id === run.id)
    if (full?.report) setReport(full.report as RoadmapReport)
  }

  const persistRun = async (nextReport: RoadmapReport) => {
    await saveAgentAnalysisRunClient({
      clientId,
      agentKey: AGENT_RUN_KEYS.salesReadinessRoadmap,
      fileName: `${clientName} — Sales Readiness ${nextReport.stage === 'report' ? 'Roadmap' : 'Checklist'}`,
      report: nextReport,
      markdown: nextReport.markdown,
      metadata: { stage: nextReport.stage },
      aiProvider: provider,
      aiModel: resolveAgentModelId(provider),
    })
    await reloadRuns({ selectNewest: true })
  }

  const generate = async (nextStage: 'checklist' | 'report') => {
    setGenerating(nextStage)
    setError(null)
    try {
      if (nextStage === 'report') {
        const latestItems = checklistRef.current
        await saveChecklistItems(clientId, latestItems)
        const res = await fetch('/api/improvement-roadmap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, stage: nextStage, checklist: latestItems, provider, modelId: resolveAgentModelId(provider) }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to generate roadmap.')
        setReport(data.report)
        await persistRun(data.report)
        return
      }
      const res = await fetch('/api/improvement-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, stage: nextStage, provider, modelId: resolveAgentModelId(provider) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed to generate ${nextStage === 'checklist' ? 'checklist' : 'roadmap'}.`)
      setReport(data.report)
      await persistRun(data.report)
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to generate ${nextStage === 'checklist' ? 'checklist' : 'roadmap'}.`)
    } finally {
      setGenerating(null)
    }
  }

  const reportRef = useRef(report)
  reportRef.current = report

  const handleToggleFlagApproval = async (titleKey: string) => {
    const currentReport = reportRef.current
    if (!currentReport?.markdown) return
    const updatedMarkdown = toggleItemApprovalInMarkdown(currentReport.markdown, titleKey)
    setReport(current => current ? { ...current, markdown: updatedMarkdown } : current)
    try {
      await fetch('/api/improvement-roadmap', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, markdown: updatedMarkdown }),
      })
    } catch (err) {
      console.error('Failed to toggle flag approval:', err)
    }
  }

  const toggleApprovalRef = useRef(handleToggleFlagApproval)
  toggleApprovalRef.current = handleToggleFlagApproval

  const markdownComponents = useMemo(() => createRoadmapMarkdownComponents({
    readOnly,
    onToggleApproval: (titleKey) => toggleApprovalRef.current(titleKey),
  }), [readOnly])

  const html = useMemo(() =>
    report?.markdown ? buildImprovementRoadmapHtml({
      workstream: 'sales-readiness',
      workstreamLabel: report.workstreamLabel || 'Sales Readiness',
      clientName: report.clientName || clientName,
      generatedAt: report.generatedAt,
      markdown: report.markdown,
    }) : '',
  [report, clientName])

  if (loading || loadingRuns) {
    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800">Sales Readiness Roadmap</h2>
            <p className="text-xs text-slate-500 mt-1">Seller-facing plan built from whatever agent outputs have already run</p>
          </div>
        </div>
        <Card className="p-16 text-center">
          <div className="mx-auto flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-sm font-semibold text-slate-800">Loading Sales Readiness Roadmap...</p>
            <p className="text-xs text-slate-500">Retrieving latest checklist and report data</p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {!readOnly && (
        <AgentRunToolbar
          provider={provider}
          onProviderChange={setProvider}
          disabled={generating !== null}
          historyItems={historyItems}
          activeId={activeId}
          onSelectRun={selectRun}
          activeProvider={activeRun?.aiProvider}
          activeModel={activeRun?.aiModel}
          activeVersion={activeRun?.version}
        />
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800">Sales Readiness Roadmap</h2>
          <p className="text-xs text-slate-500 mt-1">Seller-facing plan built from whatever agent outputs have already run</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasFullReport && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => void generate('report')}
              disabled={generating !== null || approvedCount === 0 || editingChecklist}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', generating === 'report' && 'animate-spin')} />
              {generating === 'report' ? 'Generating...' : 'Re-run Roadmap'}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void generate('checklist')}
            disabled={generating !== null || editingChecklist}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', generating === 'checklist' && 'animate-spin')} />
            {hasChecklist ? 'Regenerate Checklist' : 'Generate Checklist'}
          </Button>
          {hasFullReport && (
            <ExportReportButton html={html} fileName={`${clientName} - Sales Readiness Roadmap.pdf`} label="Export PDF" />
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {generating === 'checklist' && (
        <Card className="p-8">
          <div className="flex items-start gap-4">
            <div className="mt-1 h-5 w-5 rounded-full border-2 border-slate-200 border-t-emerald-500 animate-spin" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800">Building Sale-Readiness Checklist</h3>
              <p className="mt-1 text-sm text-slate-500">
                Reviewing completed agent outputs and drafting the checklist for advisor approval. This takes 20-40 seconds.
              </p>
              <div className="mt-5 space-y-3">
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          </div>
        </Card>
      )}

      {generating === 'report' && (
        <Card className="p-8 border-emerald-200 bg-emerald-50/50">
          <div className="flex items-start gap-4">
            <Loader2 className="mt-1 h-5 w-5 text-emerald-600 animate-spin shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800">Generating Sales Readiness Roadmap</h3>
              <p className="mt-1 text-sm text-slate-600">
                Compiling the full seller-facing roadmap from your {approvedCount} approved checklist item{approvedCount === 1 ? '' : 's'}. This takes 20-40 seconds.
              </p>
              <div className="mt-5 space-y-3">
                <div className="h-3 w-2/3 animate-pulse rounded bg-emerald-100" />
                <div className="h-3 w-full animate-pulse rounded bg-emerald-100" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-emerald-100" />
              </div>
            </div>
          </div>
        </Card>
      )}

      {hasChecklist ? (
        <>
          <ChecklistApprovalPanel
            clientId={clientId}
            clientName={clientName}
            items={checklistItems}
            sourceAgents={report?.sourceAgents ?? []}
            disabled={generating !== null}
            onUpdated={(items) => setReport(current => current ? { ...current, checklist: items } : current)}
            onEditingChange={setEditingChecklist}
          />

          {!hasFullReport && (
            <Card className="flex flex-wrap items-center justify-between gap-3 border-emerald-100 bg-emerald-50/40 p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">Step 2 — Generate the full report</p>
                {generating === 'report' ? (
                  <p className="mt-0.5 text-xs font-medium text-emerald-700">Generating report</p>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {editingChecklist
                      ? 'Save your checklist edits, then generate the full report.'
                      : approvedCount > 0
                        ? `The report will be based on ${approvedCount} approved item${approvedCount === 1 ? '' : 's'}, using your edited wording.`
                        : 'Approve the items you agree with, then generate the full report.'}
                  </p>
                )}
              </div>
              {generating === 'report' ? (
                <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700">
                  <span className="h-4 w-4 rounded-full border-2 border-emerald-200 border-t-emerald-600 animate-spin" />
                  Generating report
                </div>
              ) : (
                <Button onClick={() => void generate('report')} disabled={generating !== null || approvedCount === 0 || editingChecklist}>
                  Generate Full Report
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </Card>
          )}

          {hasFullReport && report && (
            <InlineEditableMarkdownReport
              report={report}
              markdownComponents={markdownComponents}
              readOnly={readOnly}
              onSave={async (markdown) => {
                const res = await fetch('/api/improvement-roadmap', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ clientId, markdown }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error || 'Failed to save roadmap.')
                setReport(data.report)
              }}
            />
          )}
        </>
      ) : generating ? null : (
        <Card className="p-10 text-center">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <MapPin className="w-7 h-7 text-emerald-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Sales Readiness Roadmap</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Use <strong>Generate Checklist</strong> above to build a checklist from every agent output that has already run, including custom workstreams. Approve the items you agree with, then generate the full seller-facing report.
          </p>
        </Card>
      )}
    </div>
  )
}
