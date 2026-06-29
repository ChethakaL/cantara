'use client'

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { buildWs2WorkbookReportHtml } from '@/lib/report-export/build-ws2-workbook-report'
import { parseWorkbookAddBackItems } from '@/lib/ttm-agent/ws2-workbook-export-model'
import { buildWS2ReportAdapter } from '@/lib/ttm-agent/export-adapter'
import { buildWorkbookOverrideSnapshotFromUiEdits } from '@/lib/ttm-agent/workbook-overrides'
import { logWs2Error, logWs2Response } from '@/lib/ttm-agent/browser-debug'
import type { TtmAnalysisView, Ws2DerivedReportView, Ws2RecastView } from '@/lib/ttm-agent/types'
import type { AddBackItem } from '@/lib/ws2/ws2-types'
import { computeRevenueByVertical } from '@/lib/ttm-agent/ws3-revenue'
import { computeBenchmarks } from '@/lib/ttm-agent/ws4-benchmarks'
import { computeLaborAnalysis } from '@/lib/ttm-agent/ws5-labor'
import { Badge, Button, cn } from '@/components/ui'
import { WorkbookNumberInput } from '@/components/ttm-agent/WorkbookNumberInput'

// ── Accounting Format Helpers ────────────────────────────────────────────────

function acct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const formatted = abs.toLocaleString('en-US', { maximumFractionDigits: 0 })
  if (value < 0) return `($${formatted})`
  return `$${formatted}`
}

function acctPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(1)}%`
}

function acctPctRaw(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(1)}%`
}

function acctMult(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(1)}x`
}

function negClass(value: number | null | undefined): string {
  if (value != null && value < 0) return 'text-rose-700'
  return ''
}

// ── Tab definitions ──────────────────────────────────────────────────────────

type TabId = 'valuation' | 'pl-summary' | 'normalization' | 'revenue' | 'benchmarks' | 'labor'

const TABS: { id: TabId; label: string }[] = [
  { id: 'valuation', label: 'Valuation' },
  { id: 'pl-summary', label: 'P&L / 4-Wall EBITDA' },
  { id: 'normalization', label: 'Normalization Items' },
  { id: 'revenue', label: 'Revenue Analysis' },
  { id: 'benchmarks', label: 'Expense Benchmarks' },
  { id: 'labor', label: 'Labor Analysis' },
]

// ── Types ────────────────────────────────────────────────────────────────────

type Overrides = Record<string, Record<string, number>> // itemId → { 'ltm' | 'fy3' | 'fy2' | 'fy1' → amount }

type PeriodKey = 'ltm' | 'fy3' | 'fy2' | 'fy1'

// ── Main Component ───────────────────────────────────────────────────────────

export function Ws2WorkbookView({
  analysis,
  recast,
  clientName,
  onExportXlsx,
  onWorkbookSaved,
  readOnly = false,
}: {
  analysis: TtmAnalysisView
  recast: Ws2RecastView
  clientName: string
  onExportXlsx?: () => void
  /** Called after inline edits are persisted (Done Editing → DB). Refreshes analysis so Export PDF matches. */
  onWorkbookSaved?: (analysis: TtmAnalysisView) => void
  readOnly?: boolean
}) {
  const [activeTab, setActiveTab] = useState<TabId>('valuation')
  const [editMode, setEditMode] = useState(false)
  const [savingEdits, setSavingEdits] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Overrides>({})
  const [tabOverrides, setTabOverrides] = useState<Record<string, Record<string, number>>>({}) // "tab:rowId:periodKey" → value
  const [inputDrafts, setInputDrafts] = useState<Record<string, string>>({})
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  /** In-flight tab edits (not yet blurred into React state). */
  const pendingTabEditsRef = useRef<Record<string, Partial<Record<PeriodKey, number>>>>({})

  const ws2Report = useMemo(
    () => buildWS2ReportAdapter(clientName, analysis, recast, analysis.derivedReports ?? []),
    [clientName, analysis, recast],
  )

  const years = analysis.annualModel?.years ?? []
  const multiple = recast.assumptions?.multipleMid ?? 0

  /** Same mechanism as lease analysis: self-contained HTML from `generateReportHtml` (no Tailwind snapshot). */
  const exportPdf = useCallback(() => {
    if (typeof window === 'undefined') return
    const html = buildWs2WorkbookReportHtml(analysis, recast, clientName)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 500)
  }, [analysis, recast, clientName])

  // Debug: log whether add-back items were parsed
  const adapterItems = ws2Report.ws22?.recastSchedule.addBackItems ?? []
  if (adapterItems.length === 0 && recast.reportMarkdown) {
    console.warn('[Ws2WorkbookView] Export adapter returned 0 add-back items despite reportMarkdown being present (' + recast.reportMarkdown.length + ' chars)')
  }

  // Period labels matching reference file
  const periods: { key: PeriodKey; label: string; sublabel: string }[] = useMemo(() => {
    const ttmStart = analysis.ttmSummary?.startMonth ?? ''
    const ttmEnd = analysis.ttmSummary?.endMonth ?? ''
    return [
      {
        key: 'ltm' as PeriodKey,
        label: `LTM`,
        sublabel: ttmStart && ttmEnd ? `${ttmStart} — ${ttmEnd}` : '',
      },
      ...years.map((y, i) => ({
        key: (['fy1', 'fy2', 'fy3'] as PeriodKey[])[i],
        label: y.fiscalYear ?? `FY${i + 1}`,
        sublabel: y.periodStart && y.periodEnd ? `${y.periodStart} — ${y.periodEnd}` : '',
      })).reverse(), // Show most recent first (FY3, FY2, FY1) to match reference
    ]
  }, [analysis, years])

  // ── Add-back data with overrides applied ────────────────────────────────

  // Parse add-back items from LLM valuation result, adapter, or reportMarkdown (shared with PDF export).
  const addBackItems = useMemo(
    () => parseWorkbookAddBackItems(ws2Report, recast),
    [ws2Report, recast],
  )

  const getTabOverride = useCallback((tabRowId: string, periodKey: PeriodKey): number | undefined => {
    return tabOverrides[tabRowId]?.[periodKey]
  }, [tabOverrides])

  const getEffectiveTabOverride = useCallback((tabRowId: string, periodKey: PeriodKey): number | undefined => {
    const cellId = `tab:${tabRowId}:${periodKey}`
    const draft = inputDrafts[cellId]
    if (draft !== undefined && draft.trim() !== '') {
      const parsed = Number(draft.replace(/[,$x]/gi, ''))
      if (Number.isFinite(parsed)) return parsed
    }
    const pending = pendingTabEditsRef.current[tabRowId]?.[periodKey]
    if (pending !== undefined) return pending
    return tabOverrides[tabRowId]?.[periodKey]
  }, [inputDrafts, tabOverrides])

  const savedLtmValuation = useCallback(
    (field: 'low' | 'mid' | 'high'): number | undefined => {
      const v = ws2Report.ws22?.valuation
      if (!v) return undefined
      if (field === 'low') return v.valuationLow
      if (field === 'mid') return v.valuationMid
      return v.valuationHigh
    },
    [ws2Report.ws22?.valuation],
  )

  const setTabOverrideValue = useCallback((tabRowId: string, periodKey: PeriodKey, rawValue: string) => {
    const parsed = Number(rawValue.replace(/[,$x]/gi, ''))
    if (!Number.isFinite(parsed)) return
    setTabOverrides((prev) => ({
      ...prev,
      [tabRowId]: { ...(prev[tabRowId] ?? {}), [periodKey]: parsed },
    }))
  }, [])

  const setItemOverrideValue = useCallback((itemId: string, periodKey: PeriodKey, rawValue: string) => {
    const parsed = Number(rawValue.replace(/[,$]/g, ''))
    if (!Number.isFinite(parsed)) return
    setOverrides((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? {}), [periodKey]: parsed },
    }))
  }, [])

  const inputValue = (cellId: string, value: number | null | undefined, decimals = 0) => {
    if (inputDrafts[cellId] !== undefined) return inputDrafts[cellId]
    const numeric = value ?? 0
    return decimals > 0 ? Number(numeric).toFixed(decimals) : String(Math.round(numeric))
  }

  const registerTabDraft = useCallback((rowId: string, periodKey: PeriodKey, raw: string) => {
    const parsed = Number(raw.replace(/[,$x]/gi, ''))
    if (!Number.isFinite(parsed)) return
    pendingTabEditsRef.current = {
      ...pendingTabEditsRef.current,
      [rowId]: { ...pendingTabEditsRef.current[rowId], [periodKey]: parsed },
    }
  }, [])

  const commitTabOverride = useCallback((rowId: string, periodKey: PeriodKey, parsed: number | null) => {
    if (parsed === null) return
    const row = pendingTabEditsRef.current[rowId]
    if (row) {
      const { [periodKey]: _removed, ...rest } = row
      if (Object.keys(rest).length === 0) {
        const { [rowId]: _row, ...nextPending } = pendingTabEditsRef.current
        pendingTabEditsRef.current = nextPending
      } else {
        pendingTabEditsRef.current = { ...pendingTabEditsRef.current, [rowId]: rest }
      }
    }
    setTabOverrides((prev) => ({
      ...prev,
      [rowId]: { ...(prev[rowId] ?? {}), [periodKey]: parsed },
    }))
  }, [])

  const commitItemOverride = useCallback((itemId: string, periodKey: PeriodKey, parsed: number | null) => {
    if (parsed === null) return
    setOverrides((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? {}), [periodKey]: parsed },
    }))
  }, [])

  const flushAllDraftsToOverrides = useCallback(() => {
    const mergedTab = { ...tabOverrides }
    for (const [rowId, periods] of Object.entries(pendingTabEditsRef.current)) {
      mergedTab[rowId] = { ...mergedTab[rowId], ...periods }
    }
    const mergedItems = { ...overrides }
    for (const [cellId, raw] of Object.entries(inputDrafts)) {
      const tabMatch = cellId.match(/^tab:(.+):(ltm|fy1|fy2|fy3)$/)
      if (tabMatch) {
        const parsed = Number(String(raw).replace(/[,$x]/gi, ''))
        if (Number.isFinite(parsed)) {
          const [, rowId, periodKey] = tabMatch
          mergedTab[rowId] = { ...mergedTab[rowId], [periodKey]: parsed }
        }
        continue
      }
      const itemMatch = cellId.match(/^(.+)-(ltm|fy1|fy2|fy3)$/)
      if (itemMatch) {
        const parsed = Number(String(raw).replace(/[,$]/g, ''))
        if (Number.isFinite(parsed)) {
          const [, itemId, periodKey] = itemMatch
          mergedItems[itemId] = { ...mergedItems[itemId], [periodKey]: parsed }
        }
      }
    }
    return { mergedTab, mergedItems }
  }, [inputDrafts, overrides, tabOverrides])

  const getItemValue = useCallback(
    (item: AddBackItem, periodKey: PeriodKey): number => {
      const override = overrides[item.id]?.[periodKey]
      if (override !== undefined) return override
      switch (periodKey) {
        case 'ltm': return item.ttmAmount
        case 'fy3': return item.fy3Amount ?? 0
        case 'fy2': return item.fy2Amount ?? 0
        case 'fy1': return item.fy1Amount ?? 0
      }
    },
    [overrides],
  )

  // LLM valuation result (if available, this is the sole source of truth)
  const llmResult = (recast as any).parsedReport?.llmValuationResult as {
    preRecast: Record<string, number>
    normalizedEbitda: Record<string, number>
    fourWallEbitda?: Record<string, number>
    valuation: Record<string, { low: number; mid: number; high: number }>
    normLines: Array<{ id?: string; description: string; source?: string; byPeriod?: Record<string, number> }>
  } | undefined

  const getPreRecast = useCallback(
    (periodKey: PeriodKey): number => {
      const override = getEffectiveTabOverride('valuation:pre-recast', periodKey)
      if (override !== undefined) return override
      // If LLM valuation result exists, use its preRecast values as source of truth
      if (llmResult?.preRecast) {
        const llmKey = periodKey === 'ltm' ? 'LTM' : periodKey.toUpperCase()
        const llmVal = llmResult.preRecast[llmKey] ?? llmResult.preRecast[periodKey]
        if (llmVal != null) return llmVal
      }
      // Fallback: Use Net Income (not EBITDA) as the pre-recast baseline per methodology v2.
      // Net Income includes Other Income (PPP/ERC). Falls back to EBITDA if netIncome not available.
      switch (periodKey) {
        case 'ltm': return (years[2] as any)?.netIncome ?? analysis.ttmSummary?.ebitdaPreRecast ?? 0
        case 'fy3': return (years[2] as any)?.netIncome ?? years[2]?.ebitdaPreRecast ?? 0
        case 'fy2': return (years[1] as any)?.netIncome ?? years[1]?.ebitdaPreRecast ?? 0
        case 'fy1': return (years[0] as any)?.netIncome ?? years[0]?.ebitdaPreRecast ?? 0
      }
    },
    [analysis, years, llmResult, getTabOverride],
  )

  const getRevenue = useCallback(
    (periodKey: PeriodKey): number => {
      const override = getEffectiveTabOverride('valuation:revenue', periodKey)
      if (override !== undefined) return override
      switch (periodKey) {
        case 'ltm': return analysis.ttmSummary?.totalRevenue ?? 0
        case 'fy3': return years[2]?.totalRevenue ?? 0
        case 'fy2': return years[1]?.totalRevenue ?? 0
        case 'fy1': return years[0]?.totalRevenue ?? 0
      }
    },
    [analysis, years, getTabOverride],
  )

  // Computed totals per period — LLM values are source of truth when available
  const totals = useMemo(() => {
    const result: Record<PeriodKey, { addBacks: number; normalizedEbitda: number; revenue: number; valuation: number; fourWallEbitda: number }> = {
      ltm: { addBacks: 0, normalizedEbitda: 0, revenue: 0, valuation: 0, fourWallEbitda: 0 },
      fy3: { addBacks: 0, normalizedEbitda: 0, revenue: 0, valuation: 0, fourWallEbitda: 0 },
      fy2: { addBacks: 0, normalizedEbitda: 0, revenue: 0, valuation: 0, fourWallEbitda: 0 },
      fy1: { addBacks: 0, normalizedEbitda: 0, revenue: 0, valuation: 0, fourWallEbitda: 0 },
    }
    // Helper to map periodKey to LLM period key format
    const toLlmKey = (key: PeriodKey): string => key === 'ltm' ? 'LTM' : key.toUpperCase()

    for (const key of ['ltm', 'fy3', 'fy2', 'fy1'] as PeriodKey[]) {
      const totalAB = addBackItems.reduce((sum, item) => sum + getItemValue(item, key), 0)
      const preRecast = getPreRecast(key)
      const revenue = getRevenue(key)
      const normalized = preRecast + totalAB

      // If LLM valuation result exists, use its values as source of truth
      const lk = toLlmKey(key)
      const llmNormEbitda = llmResult?.normalizedEbitda?.[lk]
      const llmFourWall = llmResult?.fourWallEbitda?.[lk]
      const llmValuation = llmResult?.valuation?.[lk]

      // 4-Wall EBITDA fallback: Normalized + Owner Replacement (add the deduction back)
      const replacementItem = addBackItems.find(item => /replacement salary/i.test(item.description))
      const replacementAmount = replacementItem
        ? getItemValue(replacementItem, key)
        : (key === 'ltm' ? 0 : -20000)

      const finalNormEbitda = llmNormEbitda ?? normalized
      const fourWallOverride = getEffectiveTabOverride('valuation:four-wall-ebitda', key)
      const finalFourWall = fourWallOverride ?? llmFourWall ?? (normalized - replacementAmount)

      result[key] = {
        addBacks: totalAB,
        normalizedEbitda: finalNormEbitda,
        revenue,
        valuation: llmValuation?.mid ?? (finalNormEbitda * multiple),
        fourWallEbitda: finalFourWall,
      }
    }
    return result
  }, [addBackItems, getItemValue, getPreRecast, getRevenue, multiple, llmResult, getTabOverride])

  // ── Inline editing ─────────────────────────────────────────────────────

  const startEdit = (cellId: string, currentValue: number) => {
    if (readOnly) return
    setEditingCell(cellId)
    setEditValue(currentValue === 0 ? '' : String(Math.round(currentValue)))
  }

  const commitEdit = (itemId: string, periodKey: PeriodKey) => {
    const parsed = Number(editValue.replace(/[,$]/g, ''))
    if (Number.isFinite(parsed)) {
      setOverrides((prev) => ({
        ...prev,
        [itemId]: { ...(prev[itemId] ?? {}), [periodKey]: parsed },
      }))
    }
    setEditingCell(null)
    setEditValue('')
  }

  const commitTabEdit = (tabRowId: string, periodKey: PeriodKey) => {
    const parsed = Number(editValue.replace(/[,$]/g, ''))
    if (Number.isFinite(parsed)) {
      setTabOverrides((prev) => ({
        ...prev,
        [tabRowId]: { ...(prev[tabRowId] ?? {}), [periodKey]: parsed },
      }))
    }
    setEditingCell(null)
    setEditValue('')
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  const countOverrideCells = (src: Record<string, Record<string, number>>) =>
    Object.values(src).reduce((n, o) => n + Object.keys(o).length, 0)

  const hasMergedEdits = (merged: { mergedTab: Record<string, Record<string, number>>; mergedItems: Overrides }) =>
    countOverrideCells(merged.mergedTab) > 0 || countOverrideCells(merged.mergedItems) > 0

  const persistUiEdits = useCallback(async (premerged?: { mergedTab: Record<string, Record<string, number>>; mergedItems: Overrides }) => {
    const merged = premerged ?? flushAllDraftsToOverrides()
    if (!hasMergedEdits(merged) || !onWorkbookSaved) return true
    setSavingEdits(true)
    setSaveError(null)
    try {
      const { mergedTab, mergedItems } = merged
      const report = buildWS2ReportAdapter(clientName, analysis, recast, analysis.derivedReports ?? [])
      const snapshot = buildWorkbookOverrideSnapshotFromUiEdits(report, mergedTab, mergedItems)
      const res = await fetch(`/api/ttm-agent/reports/${analysis.id}/workbook-overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshot }),
      })
      await logWs2Response('WS2 workbook UI save', res)
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || 'Failed to save workbook edits')
      }
      const updated = (await res.json()) as TtmAnalysisView
      onWorkbookSaved(updated)
      setOverrides({})
      setTabOverrides({})
      setInputDrafts({})
      pendingTabEditsRef.current = {}
      return true
    } catch (err) {
      logWs2Error('WS2 workbook UI save', err, { analysisId: analysis.id })
      setSaveError(err instanceof Error ? err.message : 'Failed to save workbook edits')
      return false
    } finally {
      setSavingEdits(false)
    }
  }, [
    analysis,
    clientName,
    onWorkbookSaved,
    flushAllDraftsToOverrides,
    recast,
  ])

  const handleEditToggle = async () => {
    if (readOnly) return
    if (editMode) {
      if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
      const premerged = flushAllDraftsToOverrides()
      if (hasMergedEdits(premerged)) {
        const saved = await persistUiEdits(premerged)
        if (!saved) return
      }
      pendingTabEditsRef.current = {}
      setEditMode(false)
      cancelEdit()
      return
    }
    setSaveError(null)
    setEditMode(true)
    cancelEdit()
  }

  // ── Category grouping for normalization items ──────────────────────────

  const ADD_BACK_CATEGORY_LABELS: Record<number, string> = {
    1: 'Owner / Officer Compensation',
    2: 'Personal Expenses',
    3: 'One-Off Non-Recurring Expenses',
    4: 'Tenant Improvements',
    5: 'Fair Market Rent Normalization',
  }

  const groupedItems = useMemo(() => {
    const groups = new Map<number, AddBackItem[]>()
    for (const item of addBackItems) {
      const list = groups.get(item.category) ?? []
      list.push(item)
      groups.set(item.category, list)
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0])
  }, [addBackItems])

  // ── Shared table parts ─────────────────────────────────────────────────

  const colCount = periods.length + 1 // label + periods

  function PeriodHeaders() {
    return (
      <tr className="border-b-2 border-slate-300 bg-slate-100">
        <th className="sticky left-0 z-10 bg-slate-100 px-4 py-2 text-left text-xs font-semibold text-slate-600 min-w-[260px]">
          All figures in USD
        </th>
        {periods.map((p) => (
          <th key={p.key} className="px-4 py-2 text-right min-w-[130px]">
            <div className="text-xs font-bold text-slate-800">{p.label}</div>
            <div className="text-[10px] text-slate-400 font-normal">{p.sublabel}</div>
          </th>
        ))}
      </tr>
    )
  }

  function SectionHeader({ label }: { label: string }) {
    return (
      <tr className="bg-amber-50/60">
        <td colSpan={colCount} className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-800">
          {label}
        </td>
      </tr>
    )
  }

  function DataRow({ label, values, bold, border, indent }: {
    label: string
    values: (number | null)[]
    bold?: boolean
    border?: boolean
    indent?: boolean
  }) {
    return (
      <tr className={cn(border && 'border-t-2 border-slate-300', bold && 'bg-slate-50')}>
        <td className={cn(
          'sticky left-0 z-10 bg-white px-4 py-1.5 text-sm',
          bold ? 'font-bold text-slate-900 bg-slate-50' : 'text-slate-700',
          indent && 'pl-8',
        )}>
          {label}
        </td>
        {values.map((v, i) => (
          <td
            key={periods[i]?.key ?? i}
            className={cn(
              'px-4 py-1.5 text-right text-sm tabular-nums',
              bold ? 'font-bold text-slate-900 bg-slate-50' : 'text-slate-800',
              negClass(v),
            )}
          >
            {acct(v)}
          </td>
        ))}
      </tr>
    )
  }

  function EditableSummaryRow({ rowId, label, values, bold, border }: {
    rowId: string
    label: string
    values: number[]
    bold?: boolean
    border?: boolean
  }) {
    return (
      <tr className={cn('hover:bg-blue-50/30 group', border && 'border-t-2 border-slate-300', bold && 'bg-slate-50')}>
        <td className={cn(
          'sticky left-0 z-10 bg-white px-4 py-1.5 text-sm group-hover:bg-blue-50/30',
          bold ? 'font-bold text-slate-900 bg-slate-50' : 'text-slate-700',
        )}>
          {label}
        </td>
        {periods.map((p, i) => {
          const cellId = `tab:${rowId}:${p.key}`
          const override = getEffectiveTabOverride(rowId, p.key)
          const value = override !== undefined ? override : values[i]
          const isEditing = editingCell === cellId
          if (editMode) {
            return (
              <td key={p.key} className="px-2 py-1 text-right">
                <WorkbookNumberInput
                  cellKey={cellId}
                  value={value}
                  hasOverride={override !== undefined}
                  onDraft={(raw) => registerTabDraft(rowId, p.key, raw)}
                  onCommit={(parsed) => commitTabOverride(rowId, p.key, parsed)}
                />
              </td>
            )
          }
          if (isEditing) {
            return (
              <td key={p.key} className="px-2 py-0.5 text-right">
                <input
                  autoFocus
                  type="text"
                  className="w-full rounded border border-blue-400 bg-blue-50 px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-300"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitTabEdit(rowId, p.key)
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  onBlur={() => commitTabEdit(rowId, p.key)}
                />
              </td>
            )
          }
          return (
            <td
              key={p.key}
              className={cn(
                'px-4 py-1.5 text-right text-sm tabular-nums cursor-pointer hover:bg-blue-100/50 transition-colors',
                bold ? 'font-bold text-slate-900 bg-slate-50' : 'text-slate-800',
                negClass(value),
                override !== undefined && 'bg-amber-50 font-semibold text-amber-900',
              )}
              onClick={() => startEdit(cellId, value ?? 0)}
              title="Click to edit"
            >
              {acct(value)}
            </td>
          )
        })}
      </tr>
    )
  }

  function EditableRow({ item }: { item: AddBackItem }) {
    return (
      <tr className="hover:bg-blue-50/30 group">
        <td className="sticky left-0 z-10 bg-white px-4 py-1 text-sm text-slate-700 pl-8 group-hover:bg-blue-50/30">
          <div className="flex items-center gap-2">
            <span>{item.description}</span>
            {item.glCode && <span className="text-[10px] text-slate-400">({item.glCode})</span>}
          </div>
        </td>
        {periods.map((p) => {
          const cellId = `${item.id}-${p.key}`
          const value = getItemValue(item, p.key)
          const isEditing = editingCell === cellId
          const hasOverride = overrides[item.id]?.[p.key] !== undefined
          if (editMode) {
            return (
              <td key={p.key} className="px-2 py-1 text-right">
                <WorkbookNumberInput
                  cellKey={cellId}
                  value={value}
                  hasOverride={hasOverride}
                  onCommit={(parsed) => commitItemOverride(item.id, p.key, parsed)}
                />
              </td>
            )
          }

          if (isEditing) {
            return (
              <td key={p.key} className="px-2 py-0.5 text-right">
                <input
                  autoFocus
                  type="text"
                  className="w-full rounded border border-blue-400 bg-blue-50 px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-300"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(item.id, p.key)
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  onBlur={() => commitEdit(item.id, p.key)}
                />
              </td>
            )
          }

          return (
            <td
              key={p.key}
              className={cn(
                'px-4 py-1 text-right text-sm tabular-nums cursor-pointer hover:bg-blue-100/50 transition-colors',
                negClass(value),
                hasOverride && 'bg-amber-50 font-semibold text-amber-900',
              )}
              onClick={() => startEdit(cellId, value)}
              title="Click to edit"
            >
              {acct(value)}
            </td>
          )
        })}
      </tr>
    )
  }

  /** Generic editable data row for Revenue / Benchmarks / Labor tabs */
  function EditableDataRow({
    rowId,
    label,
    sublabel,
    values,
    percentages,
    indent,
    extraColumns,
  }: {
    rowId: string
    label: string
    sublabel?: string
    values: (number | null)[]      // one per period
    percentages?: (number | null)[] // optional pct shown in parentheses
    indent?: boolean
    extraColumns?: React.ReactNode[] // extra <td>s after the period columns
  }) {
    return (
      <tr className="hover:bg-blue-50/30 group">
        <td className={cn(
          'sticky left-0 z-10 bg-white px-4 py-2 text-sm font-medium text-slate-800 group-hover:bg-blue-50/30',
          indent && 'pl-8',
        )}>
          {label}
          {sublabel && <div className="text-[10px] text-slate-400 font-normal">{sublabel}</div>}
        </td>
        {values.map((v, i) => {
          const periodKey = periods[i]?.key as PeriodKey
          if (!periodKey) return null
          const cellId = `tab:${rowId}:${periodKey}`
          const override = getEffectiveTabOverride(rowId, periodKey)
          const displayValue = override !== undefined ? override : v
          const isEditing = editingCell === cellId
          const hasOverride = override !== undefined
          const pctVal = percentages?.[i]
          if (editMode) {
            return (
              <td key={periodKey} className="px-2 py-1 text-right">
                <WorkbookNumberInput
                  cellKey={cellId}
                  value={displayValue ?? 0}
                  hasOverride={hasOverride}
                  onDraft={(raw) => registerTabDraft(rowId, periodKey, raw)}
                  onCommit={(parsed) => commitTabOverride(rowId, periodKey, parsed)}
                />
              </td>
            )
          }

          if (isEditing) {
            return (
              <td key={periodKey} className="px-2 py-0.5 text-right">
                <input
                  autoFocus
                  type="text"
                  className="w-full rounded border border-blue-400 bg-blue-50 px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-300"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitTabEdit(rowId, periodKey)
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  onBlur={() => commitTabEdit(rowId, periodKey)}
                />
              </td>
            )
          }

          return (
            <td
              key={periodKey}
              className={cn(
                'px-3 py-2 text-right text-sm tabular-nums cursor-pointer hover:bg-blue-100/50 transition-colors',
                negClass(displayValue),
                hasOverride && 'bg-amber-50 font-semibold text-amber-900',
              )}
              onClick={() => startEdit(cellId, displayValue ?? 0)}
              title="Click to edit"
            >
              {acct(displayValue)}
              {pctVal != null && !hasOverride && (
                <span className="ml-1 text-[10px] text-slate-400">({(pctVal * 100).toFixed(1)}%)</span>
              )}
            </td>
          )
        })}
        {extraColumns?.map((col, i) => <React.Fragment key={`extra-${i}`}>{col}</React.Fragment>)}
      </tr>
    )
  }

  const totalTabOverrides = countOverrideCells(tabOverrides)

  const ltmValuationAmount = useCallback(
    (field: 'low' | 'mid' | 'high') => {
      const valueRow =
        field === 'low' ? 'valuation:value-low' : field === 'mid' ? 'valuation:value-mid' : 'valuation:value-high'
      const override = getEffectiveTabOverride(valueRow, 'ltm')
      if (override !== undefined) return override
      const saved = savedLtmValuation(field)
      if (typeof saved === 'number' && Number.isFinite(saved)) return saved
      const llm = llmResult?.valuation?.LTM?.[field]
      if (typeof llm === 'number' && Number.isFinite(llm)) return llm
      const multipleRow =
        field === 'low' ? 'valuation:multiple-low' : field === 'mid' ? 'valuation:multiple-mid' : 'valuation:multiple-high'
      const effectiveMult =
        getEffectiveTabOverride(multipleRow, 'ltm') ??
        (field === 'low'
          ? recast.assumptions?.multipleLow
          : field === 'mid'
            ? recast.assumptions?.multipleMid
            : recast.assumptions?.multipleHigh) ??
        multiple
      return totals.ltm.normalizedEbitda * effectiveMult
    },
    [getEffectiveTabOverride, savedLtmValuation, llmResult, totals.ltm.normalizedEbitda, recast.assumptions, multiple],
  )

  // ── TAB: Valuation ─────────────────────────────────────────────────────

  function ValuationTab() {
    const valuationOverrideCount = Object.values(overrides).reduce((n, o) => n + Object.keys(o).length, 0)
    const totalOverrideCount = valuationOverrideCount + totalTabOverrides
    const hasOverrides = totalOverrideCount > 0
    const getMultipleLow = (periodKey: PeriodKey) => getEffectiveTabOverride('valuation:multiple-low', periodKey) ?? recast.assumptions?.multipleLow ?? multiple
    const getMultipleHigh = (periodKey: PeriodKey) => getEffectiveTabOverride('valuation:multiple-high', periodKey) ?? recast.assumptions?.multipleHigh ?? multiple
    const getValuationLow = (periodKey: PeriodKey) => {
      if (periodKey === 'ltm') return ltmValuationAmount('low')
      const override = getEffectiveTabOverride('valuation:value-low', periodKey)
      if (override !== undefined) return override
      const lk = periodKey.toUpperCase()
      return llmResult?.valuation?.[lk]?.low ?? totals[periodKey].normalizedEbitda * getMultipleLow(periodKey)
    }
    const getValuationHigh = (periodKey: PeriodKey) => {
      if (periodKey === 'ltm') return ltmValuationAmount('high')
      const override = getEffectiveTabOverride('valuation:value-high', periodKey)
      if (override !== undefined) return override
      const lk = periodKey.toUpperCase()
      return llmResult?.valuation?.[lk]?.high ?? totals[periodKey].normalizedEbitda * getMultipleHigh(periodKey)
    }
    return (
      <div className="space-y-4">
        {hasOverrides && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
            <span className="text-sm text-amber-800">
              You have edited {totalOverrideCount} cell(s) across all tabs. Totals are recalculated live.
            </span>
            <Button size="sm" variant="outline" onClick={() => { setOverrides({}); setTabOverrides({}); pendingTabEditsRef.current = {} }}>
              Reset all edits
            </Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
          <table className="min-w-full border-collapse">
            <thead><PeriodHeaders /></thead>
            <tbody className="divide-y divide-slate-100">
              {/* Valuation Summary header section */}
              <SectionHeader label="Valuation Summary" />
              <EditableSummaryRow
                rowId="valuation:revenue"
                label="Revenue"
                values={periods.map((p) => totals[p.key].revenue)}
              />
              <tr><td colSpan={colCount} className="h-1" /></tr>
              <EditableSummaryRow
                rowId="valuation:pre-recast"
                label="Net Income / EBITDA (Pre-Normalized)"
                values={periods.map((p) => getPreRecast(p.key))}
              />
              <tr><td colSpan={colCount} className="h-1" /></tr>

              {/* Normalization Items */}
              <SectionHeader label="Normalization Items" />
              {groupedItems.map(([cat, items]) => (
                items.map((item) => (
                  <EditableRow key={item.id} item={item} />
                ))
              ))}

              {/* One-Off Expenses */}
              <tr><td colSpan={colCount} className="h-1" /></tr>

              {/* Total Adjustments */}
              <DataRow
                label="Total Adjustments"
                values={periods.map((p) => totals[p.key].addBacks)}
                bold
                border
              />

              <tr><td colSpan={colCount} className="h-1" /></tr>

              {/* Revised EBITDA */}
              <DataRow
                label="Revised Net Income / EBITDA"
                values={periods.map((p) => totals[p.key].normalizedEbitda)}
                bold
                border
              />

              {/* 4-Wall EBITDA */}
              <EditableSummaryRow
                rowId="valuation:four-wall-ebitda"
                label="4-Wall EBITDA"
                values={periods.map((p) => totals[p.key].fourWallEbitda)}
                bold
              />

              <tr><td colSpan={colCount} className="h-2" /></tr>

              {/* Multiple — show range if low/high are set */}
              <tr className="bg-slate-50">
                <td className="sticky left-0 z-10 bg-slate-50 px-4 py-1.5 text-sm font-bold text-slate-900">
                  Multiple
                </td>
                {periods.map((p) => {
                  const low = getMultipleLow(p.key)
                  const high = getMultipleHigh(p.key)
                  if (editMode) {
                    return (
                      <td key={p.key} className="px-2 py-1.5 text-right">
                        <div className="flex justify-end gap-1">
                          <WorkbookNumberInput
                            cellKey={`tab:valuation:multiple-low:${p.key}`}
                            value={low}
                            decimals={1}
                            className="w-16"
                            onDraft={(raw) => registerTabDraft('valuation:multiple-low', p.key, raw)}
                            onCommit={(parsed) => commitTabOverride('valuation:multiple-low', p.key, parsed)}
                          />
                          <WorkbookNumberInput
                            cellKey={`tab:valuation:multiple-high:${p.key}`}
                            value={high}
                            decimals={1}
                            className="w-16"
                            onDraft={(raw) => registerTabDraft('valuation:multiple-high', p.key, raw)}
                            onCommit={(parsed) => commitTabOverride('valuation:multiple-high', p.key, parsed)}
                          />
                        </div>
                      </td>
                    )
                  }
                  const rangeStr = low && high ? `${Number(low).toFixed(1)}x – ${Number(high).toFixed(1)}x` : acctMult(multiple)
                  return (
                    <td key={p.key} className="px-4 py-1.5 text-right text-sm font-bold tabular-nums text-slate-900">
                      {rangeStr}
                    </td>
                  )
                })}
              </tr>

              {/* Valuation — show range if low/high multiples are set */}
              <tr className="border-t-2 border-double border-slate-400 bg-slate-800 text-white">
                <td className="sticky left-0 z-10 bg-slate-800 px-4 py-3 text-sm font-bold">
                  Valuation
                </td>
                {periods.map((p) => {
                  const valLow = getValuationLow(p.key)
                  const valHigh = getValuationHigh(p.key)
                  if (editMode) {
                    return (
                      <td key={p.key} className="px-2 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <WorkbookNumberInput
                            cellKey={`tab:valuation:value-low:${p.key}`}
                            value={valLow}
                            className="w-24"
                            onDraft={(raw) => registerTabDraft('valuation:value-low', p.key, raw)}
                            onCommit={(parsed) => commitTabOverride('valuation:value-low', p.key, parsed)}
                          />
                          <WorkbookNumberInput
                            cellKey={`tab:valuation:value-high:${p.key}`}
                            value={valHigh}
                            className="w-24"
                            onDraft={(raw) => registerTabDraft('valuation:value-high', p.key, raw)}
                            onCommit={(parsed) => commitTabOverride('valuation:value-high', p.key, parsed)}
                          />
                        </div>
                      </td>
                    )
                  }
                  return (
                    <td key={p.key} className="px-4 py-3 text-right text-sm font-bold tabular-nums text-amber-300">
                      {acct(valLow)} – {acct(valHigh)}
                    </td>
                  )
                })}
              </tr>

              {/* Margin row */}
              <tr>
                <td className="sticky left-0 z-10 bg-white px-4 py-1 text-xs text-slate-400">
                  Normalized EBITDA Margin
                </td>
                {periods.map((p) => {
                  const margin = totals[p.key].revenue ? totals[p.key].normalizedEbitda / totals[p.key].revenue : null
                  return (
                    <td key={p.key} className="px-4 py-1 text-right text-xs tabular-nums text-slate-400">
                      {acctPct(margin)}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Valuation range summary */}
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { label: 'Low', mult: recast.assumptions?.multipleLow, tone: 'slate', llmField: 'low' as const },
            { label: 'Mid', mult: recast.assumptions?.multipleMid, tone: 'amber', llmField: 'mid' as const },
            { label: 'High', mult: recast.assumptions?.multipleHigh, tone: 'slate', llmField: 'high' as const },
          ].map(({ label, mult, tone, llmField }) => {
            const valueRow = llmField === 'low' ? 'valuation:value-low' : llmField === 'high' ? 'valuation:value-high' : 'valuation:value-mid'
            const multipleRow = llmField === 'low' ? 'valuation:multiple-low' : llmField === 'high' ? 'valuation:multiple-high' : 'valuation:multiple-mid'
            const effectiveMult = getEffectiveTabOverride(multipleRow, 'ltm') ?? mult ?? multiple
            const val = ltmValuationAmount(llmField)
            return (
              <div
                key={label}
                className={cn(
                  'rounded-lg border p-4 text-center',
                  tone === 'amber' ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-slate-50',
                )}
              >
                <p className={cn('text-[11px] font-bold uppercase tracking-widest', tone === 'amber' ? 'text-slate-300' : 'text-slate-400')}>
                  {label} &middot; {acctMult(effectiveMult)}
                </p>
                {editMode ? (
                  <WorkbookNumberInput
                    cellKey={`tab:${valueRow}:ltm`}
                    value={val}
                    className="mt-2 text-center text-2xl font-semibold"
                    onDraft={(raw) => registerTabDraft(valueRow, 'ltm', raw)}
                    onCommit={(parsed) => commitTabOverride(valueRow, 'ltm', parsed)}
                  />
                ) : (
                  <p className={cn('mt-2 text-3xl font-semibold tabular-nums', tone === 'amber' ? 'text-amber-300' : 'text-slate-900')}>
                    {acct(val)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── TAB: P&L / 4-Wall EBITDA ────────────────────────────────────────────

  function PlSummaryTab() {
    const pl = ws2Report.ws21.annualPL
    const revLines = pl.revenueLines ?? []
    const cogsLines = pl.cogsLines ?? []
    const expLines = (pl.expenseLines ?? []).filter((l) => !l.excludedFromEbitda && l.cantaraCode !== 'OPX-ONEOFF')

    // Net Income from annual model (includes Other Income like PPP/ERC)
    const netIncome = {
      ttm: (years[2] as any)?.netIncome ?? pl.netIncome?.ttm ?? 0,
      fy3: (years[2] as any)?.netIncome ?? pl.netIncome?.fy3 ?? 0,
      fy2: (years[1] as any)?.netIncome ?? pl.netIncome?.fy2 ?? 0,
      fy1: (years[0] as any)?.netIncome ?? pl.netIncome?.fy1 ?? 0,
    }
    // 4-Wall EBITDA = Normalized EBITDA + Owner Replacement (before deduction)
    const fourWall = periods.map((p) => totals[p.key].fourWallEbitda)

    type Row = { label: string; values: (number | null)[]; bold?: boolean; border?: boolean; indent?: boolean; pct?: boolean; editPrefix?: string }
    const rows: Row[] = [
      { label: 'Revenue', values: [], bold: true, border: false },
      ...revLines.map((l) => ({ label: l.label, values: [l.ttm, l.fy3, l.fy2, l.fy1] as (number | null)[], indent: true, editPrefix: `pl:rev:${l.label}` })),
      { label: 'Total Revenue', values: [pl.totalRevenue.ttm, pl.totalRevenue.fy3, pl.totalRevenue.fy2, pl.totalRevenue.fy1], bold: true, border: true },
      { label: '', values: [null, null, null, null] },
      { label: 'Cost of Goods Sold', values: [], bold: true },
      ...cogsLines.map((l) => ({ label: l.label, values: [l.ttm, l.fy3, l.fy2, l.fy1] as (number | null)[], indent: true, editPrefix: `pl:cogs:${l.label}` })),
      { label: 'Total COGS', values: [pl.totalCogs.ttm, pl.totalCogs.fy3, pl.totalCogs.fy2, pl.totalCogs.fy1], bold: true, border: true },
      { label: '', values: [null, null, null, null] },
      { label: 'Gross Profit', values: [pl.grossProfit.ttm, pl.grossProfit.fy3, pl.grossProfit.fy2, pl.grossProfit.fy1], bold: true, border: true },
      { label: 'Gross Margin %', values: [pl.grossMargin.ttm, pl.grossMargin.fy3, pl.grossMargin.fy2, pl.grossMargin.fy1], pct: true },
      { label: '', values: [null, null, null, null] },
      { label: 'Operating Expenses', values: [], bold: true },
      ...expLines.map((l) => ({ label: l.label, values: [l.ttm, l.fy3, l.fy2, l.fy1] as (number | null)[], indent: true, editPrefix: `pl:exp:${l.label}` })),
      { label: 'Total OpEx', values: [pl.totalOpex.ttm, pl.totalOpex.fy3, pl.totalOpex.fy2, pl.totalOpex.fy1], bold: true, border: true },
      { label: '', values: [null, null, null, null] },
      { label: 'Net Income', values: [netIncome.ttm, netIncome.fy3, netIncome.fy2, netIncome.fy1], bold: true, border: true },
      { label: '', values: [null, null, null, null] },
      { label: 'Normalized EBITDA', values: periods.map((p) => totals[p.key].normalizedEbitda), bold: true, border: true },
      { label: 'Normalized Margin %', values: periods.map((p) => totals[p.key].revenue ? totals[p.key].normalizedEbitda / totals[p.key].revenue : null), pct: true },
      { label: '', values: [null, null, null, null] },
      { label: '4-Wall EBITDA', values: fourWall, bold: true, border: true },
      { label: '4-Wall Margin %', values: periods.map((p, i) => totals[p.key].revenue ? (fourWall[i] ?? 0) / totals[p.key].revenue : null), pct: true },
    ]

    const plOverrideCount = Object.entries(tabOverrides).filter(([k]) => k.startsWith('pl:')).reduce((n, [, o]) => n + Object.keys(o).length, 0)

    return (
      <div className="space-y-4">
        {plOverrideCount > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
            <span className="text-sm text-amber-800">
              {plOverrideCount} P&L cell(s) overridden.
            </span>
            <Button size="sm" variant="outline" onClick={() => setTabOverrides((prev) => {
              const next = { ...prev }
              for (const k of Object.keys(next)) { if (k.startsWith('pl:')) delete next[k] }
              return next
            })}>
              Reset P&L edits
            </Button>
          </div>
        )}
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
          <table className="min-w-full border-collapse">
            <thead><PeriodHeaders /></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, i) => {
                if (!row.label) return <tr key={i}><td colSpan={colCount} className="h-2" /></tr>
                if (row.values.length === 0) return <SectionHeader key={i} label={row.label} />
                if (row.pct) {
                  return (
                    <tr key={i}>
                      <td className="sticky left-0 z-10 bg-white px-4 py-1 text-xs text-slate-400">{row.label}</td>
                      {row.values.map((v, j) => (
                        <td key={periods[j]?.key ?? j} className="px-4 py-1 text-right text-xs tabular-nums text-slate-400">
                          {acctPct(v)}
                        </td>
                      ))}
                    </tr>
                  )
                }
                // Editable line items (revenue, COGS, expense lines)
                if (row.editPrefix) {
                  return (
                    <EditableDataRow
                      key={i}
                      rowId={row.editPrefix}
                      label={row.label}
                      values={row.values}
                      indent={row.indent}
                    />
                  )
                }
                return (
                  <DataRow
                    key={i}
                    label={row.label}
                    values={row.values}
                    bold={row.bold}
                    border={row.border}
                    indent={row.indent}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── TAB: Normalization Items ───────────────────────────────────────────

  function NormalizationTab() {
    const normOverrideCount = Object.entries(tabOverrides).filter(([k]) => k.startsWith('norm:')).reduce((n, [, o]) => n + Object.keys(o).length, 0)
    return (
      <div className="space-y-4">
        {normOverrideCount > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
            <span className="text-sm text-amber-800">
              {normOverrideCount} normalization cell(s) overridden.
            </span>
            <Button size="sm" variant="outline" onClick={() => setTabOverrides((prev) => {
              const next = { ...prev }
              for (const k of Object.keys(next)) { if (k.startsWith('norm:')) delete next[k] }
              return next
            })}>
              Reset normalization edits
            </Button>
          </div>
        )}
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
          <table className="min-w-full border-collapse">
            <thead><PeriodHeaders /></thead>
            <tbody className="divide-y divide-slate-100">
              {groupedItems.map(([cat, items]) => (
                <>
                  <SectionHeader key={`cat-${cat}`} label={ADD_BACK_CATEGORY_LABELS[cat] ?? `Category ${cat}`} />
                  {items.map((item) => {
                    const rowId = `norm:${item.id}`
                    return (
                      <tr key={item.id} className="hover:bg-blue-50/30 group">
                        <td className="sticky left-0 z-10 bg-white px-4 py-2 text-sm text-slate-700 pl-8 group-hover:bg-blue-50/30">
                          <div>{item.description}</div>
                          <div className="text-[10px] text-slate-400">
                            {item.glCode && `GL: ${item.glCode}`}
                            {item.glCode && item.status ? ' · ' : ''}
                            {item.status}
                          </div>
                        </td>
                        {periods.map((p) => {
                          const periodKey = p.key as PeriodKey
                          const cellId = `tab:${rowId}:${periodKey}`
                          const rawValue = getItemValue(item, periodKey)
                          const override = getEffectiveTabOverride(rowId, periodKey)
                          const displayValue = override !== undefined ? override : rawValue
                          const isEditing = editingCell === cellId
                          const hasOverride = override !== undefined

                          if (editMode) {
                            return (
                              <td key={periodKey} className="px-2 py-1 text-right">
                                <WorkbookNumberInput
                                  cellKey={cellId}
                                  value={displayValue ?? 0}
                                  hasOverride={hasOverride}
                                  onDraft={(raw) => registerTabDraft(rowId, periodKey, raw)}
                  onCommit={(parsed) => commitTabOverride(rowId, periodKey, parsed)}
                                />
                              </td>
                            )
                          }

                          if (isEditing) {
                            return (
                              <td key={periodKey} className="px-2 py-0.5 text-right">
                                <input
                                  autoFocus
                                  type="text"
                                  className="w-full rounded border border-blue-400 bg-blue-50 px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-300"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitTabEdit(rowId, periodKey)
                                    if (e.key === 'Escape') cancelEdit()
                                  }}
                                  onBlur={() => commitTabEdit(rowId, periodKey)}
                                />
                              </td>
                            )
                          }

                          return (
                            <td
                              key={periodKey}
                              className={cn(
                                'px-4 py-2 text-right text-sm tabular-nums cursor-pointer hover:bg-blue-100/50 transition-colors',
                                negClass(displayValue),
                                hasOverride && 'bg-amber-50 font-semibold text-amber-900',
                              )}
                              onClick={() => startEdit(cellId, displayValue ?? 0)}
                              title="Click to edit"
                            >
                              {acct(displayValue)}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </>
              ))}
              <DataRow
                label="Total Adjustments"
                values={periods.map((p) => totals[p.key].addBacks)}
                bold
                border
              />
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── TAB: Key Metrics ───────────────────────────────────────────────────

  // Key Metrics tab removed

  // ── TAB: Revenue Analysis (WS2-3) ─────────────────────────────────────

  function RevenueTab() {
    const revData = useMemo(() => computeRevenueByVertical(analysis), [analysis])
    const healthColor = (h: string) => h === 'GREEN' ? 'text-emerald-600' : h === 'YELLOW' ? 'text-amber-600' : 'text-rose-600'
    const healthBg = (h: string) => h === 'GREEN' ? 'bg-emerald-50' : h === 'YELLOW' ? 'bg-amber-50' : 'bg-rose-50'
    const flagColor = (s: string) => s === 'CRITICAL' ? 'border-rose-200 bg-rose-50 text-rose-800' : s === 'WARNING' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-blue-800'

    const revOverrideCount = Object.entries(tabOverrides).filter(([k]) => k.startsWith('rev:')).reduce((n, [, o]) => n + Object.keys(o).length, 0)

    return (
      <div className="space-y-4">
        {revOverrideCount > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
            <span className="text-sm text-amber-800">
              {revOverrideCount} revenue cell(s) overridden.
            </span>
            <Button size="sm" variant="outline" onClick={() => setTabOverrides((prev) => {
              const next = { ...prev }
              for (const k of Object.keys(next)) { if (k.startsWith('rev:')) delete next[k] }
              return next
            })}>
              Reset revenue edits
            </Button>
          </div>
        )}

        {/* Concentration flags */}
        {revData.concentrationFlags.length > 0 && (
          <div className="space-y-2">
            {revData.concentrationFlags.map((flag, i) => (
              <div key={i} className={cn('rounded-lg border px-4 py-3 text-sm', flagColor(flag.severity))}>
                <span className="font-semibold">{flag.severity}:</span> {flag.message}
              </div>
            ))}
          </div>
        )}

        {/* Boarding + Daycare concentration summary */}
        <div className="flex gap-4">
          {['ltm', 'fy3', 'fy2', 'fy1'].map((key, i) => {
            const val = (revData.boardingDaycareConcentration as any)[key] as number
            const label = i === 0 ? 'LTM' : periods[i]?.label ?? `FY${3 - i + 1}`
            return (
              <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-center">
                <p className="text-[10px] uppercase tracking-wide text-slate-400">Boarding + Daycare {label}</p>
                <p className={cn('mt-1 text-lg font-bold tabular-nums', val < 0.7 ? 'text-amber-600' : 'text-emerald-600')}>
                  {(val * 100).toFixed(0)}%
                </p>
              </div>
            )
          })}
        </div>

        {/* Revenue mix table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 bg-slate-100">
                <th className="sticky left-0 z-10 bg-slate-100 px-4 py-2 text-left text-xs font-semibold text-slate-600 min-w-[200px]">Vertical</th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-slate-600 w-[60px]">Health</th>
                {periods.map((p) => (
                  <th key={p.key} className="px-4 py-2 text-right min-w-[130px]">
                    <div className="text-xs font-bold text-slate-800">{p.label}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{p.sublabel}</div>
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 min-w-[70px]">FY2→3</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 min-w-[70px]">FY1→2</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {revData.verticals.map((v) => {
                const rowId = `rev:${v.name}`
                const rawValues = [v.ltm, v.fy3, v.fy2, v.fy1]
                const displayValues = periods.map((p, i) => {
                  const override = getEffectiveTabOverride(rowId, p.key)
                  return override !== undefined ? override : rawValues[i]
                })
                return (
                  <tr key={v.name} className="hover:bg-blue-50/30 group">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2 text-sm font-medium text-slate-800 group-hover:bg-blue-50/30">
                      {v.name}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', healthBg(v.health), healthColor(v.health))}>
                        {v.health}
                      </span>
                    </td>
                    {displayValues.map((val, i) => {
                      const periodKey = periods[i]?.key as PeriodKey
                      if (!periodKey) return null
                      const cellId = `tab:${rowId}:${periodKey}`
                      const override = getEffectiveTabOverride(rowId, periodKey)
                      const isEditing = editingCell === cellId
                      const hasOverride = override !== undefined
                      const pctVal = [v.ltmPct, v.fy3Pct, v.fy2Pct, v.fy1Pct][i]

                      if (editMode) {
                        return (
                          <td key={periodKey} className="px-2 py-1 text-right">
                            <WorkbookNumberInput
                              cellKey={cellId}
                              value={val ?? 0}
                              hasOverride={hasOverride}
                              onDraft={(raw) => registerTabDraft(rowId, periodKey, raw)}
                  onCommit={(parsed) => commitTabOverride(rowId, periodKey, parsed)}
                            />
                          </td>
                        )
                      }

                      if (isEditing) {
                        return (
                          <td key={periodKey} className="px-2 py-0.5 text-right">
                            <input
                              autoFocus
                              type="text"
                              className="w-full rounded border border-blue-400 bg-blue-50 px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-300"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitTabEdit(rowId, periodKey)
                                if (e.key === 'Escape') cancelEdit()
                              }}
                              onBlur={() => commitTabEdit(rowId, periodKey)}
                            />
                          </td>
                        )
                      }

                      return (
                        <td
                          key={periodKey}
                          className={cn(
                            'px-4 py-2 text-right text-sm tabular-nums cursor-pointer hover:bg-blue-100/50 transition-colors',
                            negClass(val),
                            hasOverride && 'bg-amber-50 font-semibold text-amber-900',
                          )}
                          onClick={() => startEdit(cellId, val ?? 0)}
                          title="Click to edit"
                        >
                          <span className={negClass(val)}>{acct(val)}</span>
                          {!hasOverride && pctVal != null && (
                            <span className="ml-1 text-[10px] text-slate-400">({(pctVal * 100).toFixed(1)}%)</span>
                          )}
                        </td>
                      )
                    })}
                    <td className={cn('px-3 py-2 text-right text-sm tabular-nums', v.yoyFy2toFy3 !== null && v.yoyFy2toFy3 < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                      {v.yoyFy2toFy3 !== null ? `${(v.yoyFy2toFy3 * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td className={cn('px-3 py-2 text-right text-sm tabular-nums', v.yoyFy1toFy2 !== null && v.yoyFy1toFy2 < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                      {v.yoyFy1toFy2 !== null ? `${(v.yoyFy1toFy2 * 100).toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
              {/* Total row */}
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-sm text-slate-900">Total Revenue</td>
                <td />
                {[revData.totalRevenue.ltm, revData.totalRevenue.fy3, revData.totalRevenue.fy2, revData.totalRevenue.fy1].map((v, i) => (
                  <td key={i} className="px-4 py-2 text-right text-sm tabular-nums text-slate-900">{acct(v)}</td>
                ))}
                <td className="px-3 py-2 text-right text-sm tabular-nums">
                  {revData.totalRevenue.fy2 ? `${(((revData.totalRevenue.fy3 - revData.totalRevenue.fy2) / Math.abs(revData.totalRevenue.fy2)) * 100).toFixed(0)}%` : '—'}
                </td>
                <td className="px-3 py-2 text-right text-sm tabular-nums">
                  {revData.totalRevenue.fy1 ? `${(((revData.totalRevenue.fy2 - revData.totalRevenue.fy1) / Math.abs(revData.totalRevenue.fy1)) * 100).toFixed(0)}%` : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Unmapped revenue */}
        {revData.unmappedRevenue.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">Unmapped Revenue Lines</p>
            <ul className="mt-2 text-sm text-amber-700">
              {revData.unmappedRevenue.map((u, i) => (
                <li key={i}>{u.name} ({u.code}): {acct(u.ltm)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  // ── TAB: Expense Benchmarks (WS2-4) ───────────────────────────────────

  function BenchmarksTab() {
    const bm = useMemo(() => computeBenchmarks(analysis), [analysis])
    const flagColor = (f: string) => f === 'RED' ? 'bg-rose-50 text-rose-700' : f === 'YELLOW' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
    const flagBorder = (f: string) => f === 'RED' ? 'border-rose-200' : f === 'YELLOW' ? 'border-amber-200' : 'border-emerald-200'
    const bmOverrideCount = Object.entries(tabOverrides).filter(([k]) => k.startsWith('bm:')).reduce((n, [, o]) => n + Object.keys(o).length, 0)

    return (
      <div className="space-y-4">
        {bmOverrideCount > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
            <span className="text-sm text-amber-800">
              {bmOverrideCount} benchmark cell(s) overridden.
            </span>
            <Button size="sm" variant="outline" onClick={() => setTabOverrides((prev) => {
              const next = { ...prev }
              for (const k of Object.keys(next)) { if (k.startsWith('bm:')) delete next[k] }
              return next
            })}>
              Reset benchmark edits
            </Button>
          </div>
        )}

        {/* Overall health */}
        <div className={cn('rounded-lg border px-4 py-3', flagBorder(bm.overallHealth), flagColor(bm.overallHealth))}>
          <span className="font-bold">{bm.overallHealth}:</span> {bm.overallNote}
        </div>

        {/* Benchmark table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 bg-slate-100">
                <th className="sticky left-0 z-10 bg-slate-100 px-4 py-2 text-left text-xs font-semibold text-slate-600 min-w-[180px]">Category</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 w-[80px]">Benchmark</th>
                <th className="px-2 py-2 text-center text-xs font-semibold text-slate-600 w-[50px]">Flag</th>
                {periods.map((p) => (
                  <th key={p.key} className="px-3 py-2 text-right min-w-[110px]">
                    <div className="text-xs font-bold text-slate-800">{p.label}</div>
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 min-w-[60px]">FY2→3</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bm.benchmarks.map((b) => {
                const rowId = `bm:${b.category}`
                const rawValues = [b.ltmDollar, b.fy3Dollar, b.fy2Dollar, b.fy1Dollar]
                const rawPcts = [b.ltmPct, b.fy3Pct, b.fy2Pct, b.fy1Pct]
                return (
                  <tr key={b.category} className="hover:bg-blue-50/30 group">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2 text-sm font-medium text-slate-800 group-hover:bg-blue-50/30">
                      {b.category}
                      {b.notes && <div className="text-[10px] text-slate-400 font-normal">{b.notes}</div>}
                    </td>
                    <td className="px-3 py-2 text-center text-xs tabular-nums text-slate-500">
                      {(b.benchmarkLow * 100).toFixed(0)}%–{(b.benchmarkHigh * 100).toFixed(0)}%
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', flagColor(b.flag))} title={b.flagNote}>
                        {b.flag}
                      </span>
                    </td>
                    {rawValues.map((dollar, i) => {
                      const periodKey = periods[i]?.key as PeriodKey
                      if (!periodKey) return null
                      const cellId = `tab:${rowId}:${periodKey}`
                      const override = getEffectiveTabOverride(rowId, periodKey)
                      const displayValue = override !== undefined ? override : dollar
                      const isEditing = editingCell === cellId
                      const hasOverride = override !== undefined
                      const pctVal = rawPcts[i]

                      if (editMode) {
                        return (
                          <td key={periodKey} className="px-2 py-1 text-right">
                            <WorkbookNumberInput
                              cellKey={cellId}
                              value={displayValue ?? 0}
                              hasOverride={hasOverride}
                              onDraft={(raw) => registerTabDraft(rowId, periodKey, raw)}
                  onCommit={(parsed) => commitTabOverride(rowId, periodKey, parsed)}
                            />
                          </td>
                        )
                      }

                      if (isEditing) {
                        return (
                          <td key={periodKey} className="px-2 py-0.5 text-right">
                            <input
                              autoFocus
                              type="text"
                              className="w-full rounded border border-blue-400 bg-blue-50 px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-300"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitTabEdit(rowId, periodKey)
                                if (e.key === 'Escape') cancelEdit()
                              }}
                              onBlur={() => commitTabEdit(rowId, periodKey)}
                            />
                          </td>
                        )
                      }

                      return (
                        <td
                          key={periodKey}
                          className={cn(
                            'px-3 py-2 text-right text-sm tabular-nums cursor-pointer hover:bg-blue-100/50 transition-colors',
                            hasOverride && 'bg-amber-50 font-semibold text-amber-900',
                          )}
                          onClick={() => startEdit(cellId, displayValue ?? 0)}
                          title="Click to edit"
                        >
                          {acct(displayValue)}
                          {!hasOverride && (
                            <span className={cn('ml-1 text-[10px]', pctVal > b.benchmarkHigh ? 'text-rose-500 font-semibold' : 'text-slate-400')}>
                              ({(pctVal * 100).toFixed(1)}%)
                            </span>
                          )}
                        </td>
                      )
                    })}
                    <td className={cn('px-3 py-2 text-right text-sm tabular-nums', b.yoyFy2toFy3 !== null && b.yoyFy2toFy3 > 0.15 ? 'text-rose-600' : 'text-slate-600')}>
                      {b.yoyFy2toFy3 !== null ? `${(b.yoyFy2toFy3 * 100).toFixed(0)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Flag details */}
        {bm.benchmarks.filter(b => b.flag !== 'GREEN').length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-800">Flags</h4>
            {bm.benchmarks.filter(b => b.flag !== 'GREEN').map((b) => (
              <div key={b.category} className={cn('rounded-lg border px-4 py-2 text-sm', flagBorder(b.flag), flagColor(b.flag))}>
                <span className="font-semibold">{b.category}:</span> {b.flagNote}
              </div>
            ))}
          </div>
        )}

        {/* Improvement opportunities */}
        {bm.improvementOpportunities.length > 0 && (
          <div className="rounded-lg border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-800">Improvement Opportunities</h4>
            <div className="mt-2 space-y-2">
              {bm.improvementOpportunities.map((opp) => (
                <div key={opp.category} className="text-sm text-slate-600">
                  <span className="font-medium text-slate-800">{opp.category}:</span> Currently at {(opp.currentPct * 100).toFixed(1)}% vs benchmark high of {(opp.benchmarkHigh * 100).toFixed(0)}%. Reducing to benchmark would save approximately {acct(opp.savingsDollar)} annually.
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── TAB: Labor Analysis (WS2-5) ───────────────────────────────────────

  function LaborTab() {
    const replSalary = recast.assumptions?.replacementSalary ?? 20000
    const labor = useMemo(() => computeLaborAnalysis(analysis, replSalary), [analysis, replSalary])
    const flagColor = (f: string) => f === 'RED' ? 'bg-rose-50 text-rose-700 border-rose-200' : f === 'YELLOW' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
    const laborOverrideCount = Object.entries(tabOverrides).filter(([k]) => k.startsWith('labor:')).reduce((n, [, o]) => n + Object.keys(o).length, 0)
    const periodKeys = periods.map((period) => period.key)
    const rowByCategory = new Map(labor.rows.map((row) => [row.category, row]))
    const rawLaborValue = (category: string, periodKey: PeriodKey): number => {
      const row = rowByCategory.get(category)
      if (!row) return 0
      if (periodKey === 'ltm') return row.ltmDollar ?? 0
      if (periodKey === 'fy3') return row.fy3Dollar ?? 0
      if (periodKey === 'fy2') return row.fy2Dollar ?? 0
      return row.fy1Dollar ?? 0
    }
    const laborValue = (category: string, periodKey: PeriodKey): number =>
      getEffectiveTabOverride(`labor:${category}`, periodKey) ?? rawLaborValue(category, periodKey)
    const laborRevenue = (periodKey: PeriodKey) => getRevenue(periodKey) || 0
    const directLaborValues = periodKeys.map((key) => laborValue('Staff and Direct Labor', key) + laborValue('Management Labor', key))
    const allInLaborValues = periodKeys.map((key) =>
      laborValue('Staff and Direct Labor', key) +
      laborValue('Management Labor', key) +
      laborValue('Owner Compensation', key) +
      laborValue('Payroll Taxes and Benefits', key) +
      laborValue('Tips Paid Out', key),
    )
    const buyerAdjustedValues = periodKeys.map((key) =>
      laborValue('Staff and Direct Labor', key) +
      laborValue('Management Labor', key) +
      laborValue('Payroll Taxes and Benefits', key),
    )
    const pctOfRevenue = (value: number, periodKey: PeriodKey) => {
      const revenue = laborRevenue(periodKey)
      return revenue ? value / revenue : 0
    }
    const directLaborPct = pctOfRevenue(directLaborValues[0] ?? 0, 'ltm')
    const allInLaborPct = pctOfRevenue(allInLaborValues[0] ?? 0, 'ltm')
    const buyerAdjustedPct = pctOfRevenue(buyerAdjustedValues[0] ?? 0, 'ltm')
    const laborStatus = directLaborPct > 0.45 ? 'RED' : directLaborPct > 0.42 ? 'YELLOW' : 'GREEN'
    const laborStatusNote = laborStatus === 'RED'
      ? `Direct labor at ${(directLaborPct * 100).toFixed(1)}% exceeds the 45% Cantara deal-risk threshold.`
      : laborStatus === 'YELLOW'
        ? `Direct labor at ${(directLaborPct * 100).toFixed(1)}% is near the 45% Cantara deal-risk threshold.`
        : `Direct labor at ${(directLaborPct * 100).toFixed(1)}% is within the Cantara benchmark range.`
    const derivedTotalByCategory: Record<string, number[]> = {
      'Total All-In Labor': allInLaborValues,
      'Buyer-Adjusted Labor': buyerAdjustedValues,
    }

    return (
      <div className="space-y-4">
        {laborOverrideCount > 0 && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
            <span className="text-sm text-amber-800">
              {laborOverrideCount} labor cell(s) overridden.
            </span>
            <Button size="sm" variant="outline" onClick={() => setTabOverrides((prev) => {
              const next = { ...prev }
              for (const k of Object.keys(next)) { if (k.startsWith('labor:')) delete next[k] }
              return next
            })}>
              Reset labor edits
            </Button>
          </div>
        )}

        {/* Benchmark status */}
        <div className={cn('rounded-lg border px-4 py-3', flagColor(laborStatus))}>
          <span className="font-bold">{laborStatus}:</span> {laborStatusNote}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Direct Labor (Staff + Management)</p>
            <p className={cn('mt-1 text-2xl font-bold tabular-nums', directLaborPct > 0.45 ? 'text-rose-600' : 'text-slate-900')}>
              {(directLaborPct * 100).toFixed(1)}%
            </p>
            <p className="text-[10px] text-slate-400">Benchmark: 35%-45%</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">All-In Labor</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {(allInLaborPct * 100).toFixed(1)}%
            </p>
            <p className="text-[10px] text-slate-400">Includes owner + tips</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Buyer-Adjusted Labor</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {(buyerAdjustedPct * 100).toFixed(1)}%
            </p>
            <p className="text-[10px] text-slate-400">Post-acquisition view</p>
          </div>
        </div>

        {/* Labor breakdown table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 bg-slate-100">
                <th className="sticky left-0 z-10 bg-slate-100 px-4 py-2 text-left text-xs font-semibold text-slate-600 min-w-[220px]">Category</th>
                {periods.map((p) => (
                  <th key={p.key} className="px-3 py-2 text-right min-w-[120px]">
                    <div className="text-xs font-bold text-slate-800">{p.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {labor.rows.map((row) => {
                // Total rows remain read-only
                if (row.isTotal) {
                  const derivedValues = derivedTotalByCategory[row.category] ?? [
                    row.ltmDollar,
                    row.fy3Dollar,
                    row.fy2Dollar,
                    row.fy1Dollar,
                  ]
                  return (
                    <tr key={row.category} className="bg-slate-50 border-t-2 border-slate-300">
                      <td className="sticky left-0 z-10 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-900">
                        {row.category}
                      </td>
                      {derivedValues.map((dollar, i) => {
                        const periodKey = periodKeys[i] ?? 'ltm'
                        const pctVal = pctOfRevenue(dollar, periodKey)
                        return (
                        <td key={i} className="px-3 py-2 text-right text-sm tabular-nums font-bold text-slate-900">
                          {acct(dollar)}
                          <span className="ml-1 text-[10px] text-slate-400">({(pctVal * 100).toFixed(1)}%)</span>
                        </td>
                        )
                      })}
                    </tr>
                  )
                }

                // Editable data rows
                const rowId = `labor:${row.category}`
                const rawValues = [row.ltmDollar, row.fy3Dollar, row.fy2Dollar, row.fy1Dollar]
                const rawPcts = [row.ltmPct, row.fy3Pct, row.fy2Pct, row.fy1Pct]
                return (
                  <tr key={row.category} className="hover:bg-blue-50/30 group">
                    <td className="sticky left-0 z-10 bg-white px-4 py-2 text-sm text-slate-700 pl-8 group-hover:bg-blue-50/30">
                      {row.category}
                    </td>
                    {rawValues.map((dollar, i) => {
                      const periodKey = periods[i]?.key as PeriodKey
                      if (!periodKey) return null
                      const cellId = `tab:${rowId}:${periodKey}`
                      const override = getEffectiveTabOverride(rowId, periodKey)
                      const displayValue = override !== undefined ? override : dollar
                      const isEditing = editingCell === cellId
                      const hasOverride = override !== undefined
                      const pctVal = pctOfRevenue(displayValue ?? 0, periodKey)

                      if (editMode) {
                        return (
                          <td key={periodKey} className="px-2 py-1 text-right">
                            <WorkbookNumberInput
                              cellKey={cellId}
                              value={displayValue ?? 0}
                              hasOverride={hasOverride}
                              onDraft={(raw) => registerTabDraft(rowId, periodKey, raw)}
                  onCommit={(parsed) => commitTabOverride(rowId, periodKey, parsed)}
                            />
                          </td>
                        )
                      }

                      if (isEditing) {
                        return (
                          <td key={periodKey} className="px-2 py-0.5 text-right">
                            <input
                              autoFocus
                              type="text"
                              className="w-full rounded border border-blue-400 bg-blue-50 px-2 py-1 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-blue-300"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitTabEdit(rowId, periodKey)
                                if (e.key === 'Escape') cancelEdit()
                              }}
                              onBlur={() => commitTabEdit(rowId, periodKey)}
                            />
                          </td>
                        )
                      }

                      return (
                        <td
                          key={periodKey}
                          className={cn(
                            'px-3 py-2 text-right text-sm tabular-nums cursor-pointer hover:bg-blue-100/50 transition-colors',
                            hasOverride && 'bg-amber-50 font-semibold text-amber-900',
                          )}
                          onClick={() => startEdit(cellId, displayValue ?? 0)}
                          title="Click to edit"
                        >
                          {acct(displayValue)}
                          {!hasOverride && (
                            <span className="ml-1 text-[10px] text-slate-400">({(pctVal * 100).toFixed(1)}%)</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Trend */}
        <div className={cn('rounded-lg border px-4 py-3 text-sm', labor.trendAssessment === 'DETERIORATING' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-700')}>
          <span className="font-semibold">Trend ({labor.trendAssessment}):</span> {labor.trendNote}
        </div>

        {/* Flags */}
        {labor.flags.length > 0 && (
          <div className="space-y-2">
            {labor.flags.map((flag, i) => (
              <div key={i} className={cn('rounded-lg border px-4 py-2 text-sm', flagColor(flag.severity))}>
                <span className="font-semibold">{flag.type}:</span> {flag.message}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {saveError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {saveError}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{clientName} — Valuation Analysis</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {periods[0]?.sublabel ? `LTM: ${periods[0].sublabel}` : ''}
            {multiple ? ` · Multiple: ${acctMult(multiple)}` : ''}
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Badge color="green">WS2-2 Approved</Badge>
            <Button
              size="sm"
              variant={editMode ? 'primary' : 'outline'}
              onClick={() => void handleEditToggle()}
              disabled={savingEdits}
            >
              {savingEdits ? 'Saving...' : editMode ? 'Done Editing' : 'Edit all fields'}
            </Button>
            <Button size="sm" variant="outline" onClick={exportPdf}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Export PDF
            </Button>
            {onExportXlsx && (
              <Button size="sm" variant="outline" onClick={onExportXlsx}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export XLSX
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cn(
              'whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'valuation' && <ValuationTab />}
      {activeTab === 'pl-summary' && <PlSummaryTab />}
      {activeTab === 'normalization' && <NormalizationTab />}
      {activeTab === 'revenue' && <RevenueTab />}
      {activeTab === 'benchmarks' && <BenchmarksTab />}
      {activeTab === 'labor' && <LaborTab />}
    </div>
  )
}
