'use client'

import { useCallback, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { buildWS2ReportAdapter } from '@/lib/ttm-agent/export-adapter'
import type { TtmAnalysisView, Ws2DerivedReportView, Ws2RecastView } from '@/lib/ttm-agent/types'
import type { AddBackItem } from '@/lib/ws2/ws2-types'
import { computeRevenueByVertical } from '@/lib/ttm-agent/ws3-revenue'
import { computeBenchmarks } from '@/lib/ttm-agent/ws4-benchmarks'
import { computeLaborAnalysis } from '@/lib/ttm-agent/ws5-labor'
import { Badge, Button, cn } from '@/components/ui'

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

type TabId = 'valuation' | 'pl-summary' | 'normalization' | 'key-metrics' | 'revenue' | 'benchmarks' | 'labor'

const TABS: { id: TabId; label: string }[] = [
  { id: 'valuation', label: 'Valuation' },
  { id: 'pl-summary', label: 'P&L / 4-Wall EBITDA' },
  { id: 'normalization', label: 'Normalization Items' },
  { id: 'key-metrics', label: 'Key Metrics' },
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
}: {
  analysis: TtmAnalysisView
  recast: Ws2RecastView
  clientName: string
  onExportXlsx?: () => void
}) {
  const [activeTab, setActiveTab] = useState<TabId>('valuation')
  const [overrides, setOverrides] = useState<Overrides>({})
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const ws2Report = useMemo(
    () => buildWS2ReportAdapter(clientName, analysis, recast, analysis.derivedReports ?? []),
    [clientName, analysis, recast],
  )

  const years = analysis.annualModel?.years ?? []
  const multiple = recast.assumptions?.multipleMid ?? 0

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

  // Parse add-back items from reportMarkdown
  // Handles multiple format variants the LLM may produce
  const addBackItems = useMemo(() => {
    const fromAdapter = ws2Report.ws22?.recastSchedule.addBackItems ?? []
    if (fromAdapter.length > 0) return fromAdapter

    const md = recast.reportMarkdown
    if (!md) return []

    function parseCur(raw: string): number {
      const cleaned = raw.replace(/\*\*/g, '').replace(/\$/g, '').replace(/,/g, '').trim().replace(/^\((.*)\)$/, '-$1')
      const n = Number(cleaned)
      return Number.isFinite(n) ? n : 0
    }

    // Find EBITDA RECAST SCHEDULE section
    const sectionMatch = md.match(/## EBITDA RECAST SCHEDULE([\s\S]*?)(?:\n## 3-YEAR|\n## FLAG LIST|\n## PRELIMINARY|$)/i)
    if (!sectionMatch) return []

    const tableLines = sectionMatch[1]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('|'))
      .filter(l => !/^\|\s*-+/.test(l))
      .map(l => l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim().replace(/\*\*/g, '')))

    if (tableLines.length < 2) return []

    // Detect format from header row
    const header = tableLines[0]
    const dataRows = tableLines.slice(1)

    // Determine which columns hold TTM/LTM, FY3, FY2, FY1
    // Format A: "Normalization Items | TTM (...) | FY3 (...) | FY2 (...) | FY1 (...) | Comments"
    // Format B: "# | Category | Item Description | GL Reference | LTM | FY3 | FY2 | FY1 | Status"
    // Format C: "# | Category | Item Description | GL Reference | TTM Amount | Status"
    let nameCol = 0, ttmCol = -1, fy3Col = -1, fy2Col = -1, fy1Col = -1
    for (let i = 0; i < header.length; i++) {
      const h = header[i].toLowerCase()
      if (/normalization items|item description/i.test(header[i])) nameCol = i
      if (/^(ttm|ltm)/.test(h) || h === 'ttm amount') ttmCol = i
      if (/^fy3|^fy\s*3/.test(h) || /fy3\s*\(/i.test(header[i])) fy3Col = i
      if (/^fy2|^fy\s*2/.test(h) || /fy2\s*\(/i.test(header[i])) fy2Col = i
      if (/^fy1|^fy\s*1/.test(h) || /fy1\s*\(/i.test(header[i])) fy1Col = i
    }

    if (ttmCol === -1) {
      // Try positional: first numeric column after name
      ttmCol = nameCol + 1
      if (header.length > ttmCol + 3) {
        fy3Col = ttmCol + 1
        fy2Col = ttmCol + 2
        fy1Col = ttmCol + 3
      }
    }

    let itemIndex = 0
    return dataRows
      .filter(c => {
        const name = c[nameCol] ?? ''
        return !/Total Adjustments|Revised Net Income|Revenue|Net Income\/EBITDA|^Multiple$|^Valuation$/i.test(name) &&
               !/Total Adjustments|Revised|Multiple|Valuation/i.test(name)
      })
      .map(c => {
        itemIndex++
        const name = c[nameCol] ?? ''
        const catGuess = /Insurance|Consulting|Draw|Salary|Replacement|Owner|Officer/i.test(name) ? 1
          : /Donation|Gift|Meal|Travel|Church/i.test(name) ? 2
          : /Non-Recurring|Repair|One-Off/i.test(name) ? 3
          : /Tenant|TI|Leasehold/i.test(name) ? 4
          : /Rent|FMR/i.test(name) ? 5
          : 2
        return {
          id: String(itemIndex),
          category: catGuess as AddBackItem['category'],
          description: name,
          glCode: undefined,
          ttmAmount: ttmCol >= 0 ? parseCur(c[ttmCol] ?? '0') : 0,
          fy3Amount: fy3Col >= 0 ? parseCur(c[fy3Col] ?? '0') : undefined,
          fy2Amount: fy2Col >= 0 ? parseCur(c[fy2Col] ?? '0') : undefined,
          fy1Amount: fy1Col >= 0 ? parseCur(c[fy1Col] ?? '0') : undefined,
          status: 'VERIFIED' as AddBackItem['status'],
        }
      })
  }, [ws2Report, recast.reportMarkdown])

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

  const getPreRecast = useCallback(
    (periodKey: PeriodKey): number => {
      // Use Net Income (not EBITDA) as the pre-recast baseline per methodology v2.
      // Net Income includes Other Income (PPP/ERC). Falls back to EBITDA if netIncome not available.
      switch (periodKey) {
        case 'ltm': return (years[2] as any)?.netIncome ?? analysis.ttmSummary?.ebitdaPreRecast ?? 0
        case 'fy3': return (years[2] as any)?.netIncome ?? years[2]?.ebitdaPreRecast ?? 0
        case 'fy2': return (years[1] as any)?.netIncome ?? years[1]?.ebitdaPreRecast ?? 0
        case 'fy1': return (years[0] as any)?.netIncome ?? years[0]?.ebitdaPreRecast ?? 0
      }
    },
    [analysis, years],
  )

  const getRevenue = useCallback(
    (periodKey: PeriodKey): number => {
      switch (periodKey) {
        case 'ltm': return analysis.ttmSummary?.totalRevenue ?? 0
        case 'fy3': return years[2]?.totalRevenue ?? 0
        case 'fy2': return years[1]?.totalRevenue ?? 0
        case 'fy1': return years[0]?.totalRevenue ?? 0
      }
    },
    [analysis, years],
  )

  // Computed totals per period
  const totals = useMemo(() => {
    const result: Record<PeriodKey, { addBacks: number; normalizedEbitda: number; revenue: number; valuation: number }> = {
      ltm: { addBacks: 0, normalizedEbitda: 0, revenue: 0, valuation: 0 },
      fy3: { addBacks: 0, normalizedEbitda: 0, revenue: 0, valuation: 0 },
      fy2: { addBacks: 0, normalizedEbitda: 0, revenue: 0, valuation: 0 },
      fy1: { addBacks: 0, normalizedEbitda: 0, revenue: 0, valuation: 0 },
    }
    for (const key of ['ltm', 'fy3', 'fy2', 'fy1'] as PeriodKey[]) {
      const totalAB = addBackItems.reduce((sum, item) => sum + getItemValue(item, key), 0)
      const preRecast = getPreRecast(key)
      const revenue = getRevenue(key)
      const normalized = preRecast + totalAB
      // 4-Wall EBITDA = Normalized + Owner Replacement (add the deduction back)
      const replacementItem = addBackItems.find(item => /replacement salary/i.test(item.description))
      const replacementAmount = replacementItem ? getItemValue(replacementItem, key) : 0
      result[key] = {
        addBacks: totalAB,
        normalizedEbitda: normalized,
        revenue,
        valuation: normalized * multiple,
        fourWallEbitda: normalized - replacementAmount, // subtract the negative = add it back
      } as any
    }
    return result
  }, [addBackItems, getItemValue, getPreRecast, getRevenue, multiple])

  // ── Inline editing ─────────────────────────────────────────────────────

  const startEdit = (cellId: string, currentValue: number) => {
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

  const cancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
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

  // ── TAB: Valuation ─────────────────────────────────────────────────────

  function ValuationTab() {
    const hasOverrides = Object.keys(overrides).length > 0
    return (
      <div className="space-y-4">
        {hasOverrides && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
            <span className="text-sm text-amber-800">
              You have edited {Object.values(overrides).reduce((n, o) => n + Object.keys(o).length, 0)} cell(s). Totals are recalculated live.
            </span>
            <Button size="sm" variant="outline" onClick={() => setOverrides({})}>
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
              <DataRow
                label="Revenue"
                values={periods.map((p) => totals[p.key].revenue)}
              />
              <tr><td colSpan={colCount} className="h-1" /></tr>
              <DataRow
                label="Net Income / EBITDA (Pre-Recast)"
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
              <DataRow
                label="4-Wall EBITDA"
                values={periods.map((p) => (totals[p.key] as any).fourWallEbitda ?? totals[p.key].normalizedEbitda)}
                bold
              />

              <tr><td colSpan={colCount} className="h-2" /></tr>

              {/* Multiple */}
              <tr className="bg-slate-50">
                <td className="sticky left-0 z-10 bg-slate-50 px-4 py-1.5 text-sm font-bold text-slate-900">
                  Multiple
                </td>
                {periods.map((p) => (
                  <td key={p.key} className="px-4 py-1.5 text-right text-sm font-bold tabular-nums text-slate-900">
                    {acctMult(multiple)}
                  </td>
                ))}
              </tr>

              {/* Valuation */}
              <tr className="border-t-2 border-double border-slate-400 bg-slate-800 text-white">
                <td className="sticky left-0 z-10 bg-slate-800 px-4 py-3 text-sm font-bold">
                  Valuation
                </td>
                {periods.map((p) => (
                  <td key={p.key} className="px-4 py-3 text-right text-lg font-bold tabular-nums text-amber-300">
                    {acct(totals[p.key].valuation)}
                  </td>
                ))}
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
            { label: 'Low', mult: recast.assumptions?.multipleLow, tone: 'slate' },
            { label: 'Mid', mult: recast.assumptions?.multipleMid, tone: 'amber' },
            { label: 'High', mult: recast.assumptions?.multipleHigh, tone: 'slate' },
          ].map(({ label, mult, tone }) => {
            const val = (totals.ltm.normalizedEbitda) * (mult ?? 0)
            return (
              <div
                key={label}
                className={cn(
                  'rounded-lg border p-4 text-center',
                  tone === 'amber' ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-200 bg-slate-50',
                )}
              >
                <p className={cn('text-[11px] font-bold uppercase tracking-widest', tone === 'amber' ? 'text-slate-300' : 'text-slate-400')}>
                  {label} &middot; {acctMult(mult)}
                </p>
                <p className={cn('mt-2 text-3xl font-semibold tabular-nums', tone === 'amber' ? 'text-amber-300' : 'text-slate-900')}>
                  {acct(val)}
                </p>
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
    const fourWall = periods.map((p) => (totals[p.key] as any).fourWallEbitda ?? totals[p.key].normalizedEbitda)

    type Row = { label: string; values: (number | null)[]; bold?: boolean; border?: boolean; indent?: boolean; pct?: boolean }
    const rows: Row[] = [
      { label: 'Revenue', values: [], bold: true, border: false },
      ...revLines.map((l) => ({ label: l.label, values: [l.ttm, l.fy3, l.fy2, l.fy1] as (number | null)[], indent: true })),
      { label: 'Total Revenue', values: [pl.totalRevenue.ttm, pl.totalRevenue.fy3, pl.totalRevenue.fy2, pl.totalRevenue.fy1], bold: true, border: true },
      { label: '', values: [null, null, null, null] },
      { label: 'Cost of Goods Sold', values: [], bold: true },
      ...cogsLines.map((l) => ({ label: l.label, values: [l.ttm, l.fy3, l.fy2, l.fy1] as (number | null)[], indent: true })),
      { label: 'Total COGS', values: [pl.totalCogs.ttm, pl.totalCogs.fy3, pl.totalCogs.fy2, pl.totalCogs.fy1], bold: true, border: true },
      { label: '', values: [null, null, null, null] },
      { label: 'Gross Profit', values: [pl.grossProfit.ttm, pl.grossProfit.fy3, pl.grossProfit.fy2, pl.grossProfit.fy1], bold: true, border: true },
      { label: 'Gross Margin %', values: [pl.grossMargin.ttm, pl.grossMargin.fy3, pl.grossMargin.fy2, pl.grossMargin.fy1], pct: true },
      { label: '', values: [null, null, null, null] },
      { label: 'Operating Expenses', values: [], bold: true },
      ...expLines.map((l) => ({ label: l.label, values: [l.ttm, l.fy3, l.fy2, l.fy1] as (number | null)[], indent: true })),
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

    return (
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
    )
  }

  // ── TAB: Normalization Items ───────────────────────────────────────────

  function NormalizationTab() {
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
        <table className="min-w-full border-collapse">
          <thead><PeriodHeaders /></thead>
          <tbody className="divide-y divide-slate-100">
            {groupedItems.map(([cat, items]) => (
              <>
                <SectionHeader key={`cat-${cat}`} label={ADD_BACK_CATEGORY_LABELS[cat] ?? `Category ${cat}`} />
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="sticky left-0 z-10 bg-white px-4 py-2 text-sm text-slate-700 pl-8">
                      <div>{item.description}</div>
                      <div className="text-[10px] text-slate-400">
                        {item.glCode && `GL: ${item.glCode}`}
                        {item.glCode && item.status ? ' · ' : ''}
                        {item.status}
                      </div>
                    </td>
                    {periods.map((p) => (
                      <td key={p.key} className={cn('px-4 py-2 text-right text-sm tabular-nums', negClass(getItemValue(item, p.key)))}>
                        {acct(getItemValue(item, p.key))}
                      </td>
                    ))}
                  </tr>
                ))}
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
    )
  }

  // ── TAB: Key Metrics ───────────────────────────────────────────────────

  function KeyMetricsTab() {
    const pl = ws2Report.ws21.annualPL
    const metrics: { label: string; values: (number | null)[]; kind: 'currency' | 'pct' }[] = [
      { label: 'Revenue', values: periods.map((p) => totals[p.key].revenue), kind: 'currency' },
      { label: 'Revenue growth %', values: [null, ...[pl.yoyRevenueGrowth.fy2toFy3, pl.yoyRevenueGrowth.fy1toFy2, null]], kind: 'pct' },
      { label: 'Normalized EBITDA', values: periods.map((p) => totals[p.key].normalizedEbitda), kind: 'currency' },
      { label: 'Normalized EBITDA Margin', values: periods.map((p) => totals[p.key].revenue ? totals[p.key].normalizedEbitda / totals[p.key].revenue : null), kind: 'pct' },
      { label: 'Gross Profit', values: [pl.grossProfit.ttm, pl.grossProfit.fy3, pl.grossProfit.fy2, pl.grossProfit.fy1], kind: 'currency' },
      { label: 'Gross Margin', values: [pl.grossMargin.ttm, pl.grossMargin.fy3, pl.grossMargin.fy2, pl.grossMargin.fy1], kind: 'pct' },
      { label: 'Total OpEx', values: [pl.totalOpex.ttm, pl.totalOpex.fy3, pl.totalOpex.fy2, pl.totalOpex.fy1], kind: 'currency' },
      { label: 'Pre-Recast EBITDA', values: periods.map((p) => getPreRecast(p.key)), kind: 'currency' },
      { label: 'Pre-Recast EBITDA Margin', values: [pl.ebitdaMargin.ttm, pl.ebitdaMargin.fy3, pl.ebitdaMargin.fy2, pl.ebitdaMargin.fy1], kind: 'pct' },
    ]

    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
        <table className="min-w-full border-collapse">
          <thead><PeriodHeaders /></thead>
          <tbody className="divide-y divide-slate-100">
            <SectionHeader label="Normalized Key Metrics" />
            {metrics.map((m) => (
              <tr key={m.label}>
                <td className="sticky left-0 z-10 bg-white px-4 py-1.5 text-sm text-slate-700">{m.label}</td>
                {m.values.map((v, i) => (
                  <td key={periods[i]?.key ?? i} className={cn('px-4 py-1.5 text-right text-sm tabular-nums', negClass(v))}>
                    {m.kind === 'currency' ? acct(v) : acctPct(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ── TAB: Revenue Analysis (WS2-3) ─────────────────────────────────────

  function RevenueTab() {
    const revData = useMemo(() => computeRevenueByVertical(analysis), [analysis])
    const healthColor = (h: string) => h === 'GREEN' ? 'text-emerald-600' : h === 'YELLOW' ? 'text-amber-600' : 'text-rose-600'
    const healthBg = (h: string) => h === 'GREEN' ? 'bg-emerald-50' : h === 'YELLOW' ? 'bg-amber-50' : 'bg-rose-50'
    const flagColor = (s: string) => s === 'CRITICAL' ? 'border-rose-200 bg-rose-50 text-rose-800' : s === 'WARNING' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-blue-800'

    return (
      <div className="space-y-4">
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
              {revData.verticals.map((v) => (
                <tr key={v.name} className="hover:bg-slate-50/50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 text-sm font-medium text-slate-800">
                    {v.name}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', healthBg(v.health), healthColor(v.health))}>
                      {v.health}
                    </span>
                  </td>
                  {[
                    { val: v.ltm, pctVal: v.ltmPct },
                    { val: v.fy3, pctVal: v.fy3Pct },
                    { val: v.fy2, pctVal: v.fy2Pct },
                    { val: v.fy1, pctVal: v.fy1Pct },
                  ].map(({ val, pctVal }, i) => (
                    <td key={i} className="px-4 py-2 text-right text-sm tabular-nums">
                      <span className={negClass(val)}>{acct(val)}</span>
                      <span className="ml-1 text-[10px] text-slate-400">({(pctVal * 100).toFixed(1)}%)</span>
                    </td>
                  ))}
                  <td className={cn('px-3 py-2 text-right text-sm tabular-nums', v.yoyFy2toFy3 !== null && v.yoyFy2toFy3 < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                    {v.yoyFy2toFy3 !== null ? `${(v.yoyFy2toFy3 * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className={cn('px-3 py-2 text-right text-sm tabular-nums', v.yoyFy1toFy2 !== null && v.yoyFy1toFy2 < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                    {v.yoyFy1toFy2 !== null ? `${(v.yoyFy1toFy2 * 100).toFixed(0)}%` : '—'}
                  </td>
                </tr>
              ))}
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

    return (
      <div className="space-y-4">
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
              {bm.benchmarks.map((b) => (
                <tr key={b.category} className="hover:bg-slate-50/50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2 text-sm font-medium text-slate-800">
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
                  {[
                    { dollar: b.ltmDollar, pct: b.ltmPct },
                    { dollar: b.fy3Dollar, pct: b.fy3Pct },
                    { dollar: b.fy2Dollar, pct: b.fy2Pct },
                    { dollar: b.fy1Dollar, pct: b.fy1Pct },
                  ].map(({ dollar, pct }, i) => (
                    <td key={i} className="px-3 py-2 text-right text-sm tabular-nums">
                      {acct(dollar)}
                      <span className={cn('ml-1 text-[10px]', pct > b.benchmarkHigh ? 'text-rose-500 font-semibold' : 'text-slate-400')}>
                        ({(pct * 100).toFixed(1)}%)
                      </span>
                    </td>
                  ))}
                  <td className={cn('px-3 py-2 text-right text-sm tabular-nums', b.yoyFy2toFy3 !== null && b.yoyFy2toFy3 > 0.15 ? 'text-rose-600' : 'text-slate-600')}>
                    {b.yoyFy2toFy3 !== null ? `${(b.yoyFy2toFy3 * 100).toFixed(0)}%` : '—'}
                  </td>
                </tr>
              ))}
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

    return (
      <div className="space-y-4">
        {/* Benchmark status */}
        <div className={cn('rounded-lg border px-4 py-3', flagColor(labor.benchmarkStatus))}>
          <span className="font-bold">{labor.benchmarkStatus}:</span> {labor.benchmarkNote}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Direct Labor (Staff + Management)</p>
            <p className={cn('mt-1 text-2xl font-bold tabular-nums', labor.directLaborPct > 0.45 ? 'text-rose-600' : 'text-slate-900')}>
              {(labor.directLaborPct * 100).toFixed(1)}%
            </p>
            <p className="text-[10px] text-slate-400">Benchmark: 35%-45%</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">All-In Labor</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {(labor.allInLaborPct * 100).toFixed(1)}%
            </p>
            <p className="text-[10px] text-slate-400">Includes owner + tips</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Buyer-Adjusted Labor</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
              {(labor.buyerAdjustedPct * 100).toFixed(1)}%
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
              {labor.rows.map((row) => (
                <tr key={row.category} className={row.isTotal ? 'bg-slate-50 border-t-2 border-slate-300' : 'hover:bg-slate-50/50'}>
                  <td className={cn('sticky left-0 z-10 bg-white px-4 py-2 text-sm', row.isTotal ? 'font-bold text-slate-900 bg-slate-50' : 'text-slate-700 pl-8')}>
                    {row.category}
                  </td>
                  {[
                    { dollar: row.ltmDollar, pctVal: row.ltmPct },
                    { dollar: row.fy3Dollar, pctVal: row.fy3Pct },
                    { dollar: row.fy2Dollar, pctVal: row.fy2Pct },
                    { dollar: row.fy1Dollar, pctVal: row.fy1Pct },
                  ].map(({ dollar, pctVal }, i) => (
                    <td key={i} className="px-3 py-2 text-right text-sm tabular-nums">
                      {acct(dollar)}
                      <span className="ml-1 text-[10px] text-slate-400">({(pctVal * 100).toFixed(1)}%)</span>
                    </td>
                  ))}
                </tr>
              ))}
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
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{clientName} — Valuation Analysis</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {periods[0]?.sublabel ? `LTM: ${periods[0].sublabel}` : ''}
            {multiple ? ` · Multiple: ${acctMult(multiple)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge color="green">WS2-2 Approved</Badge>
          {onExportXlsx && (
            <Button size="sm" variant="outline" onClick={onExportXlsx}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export XLSX
            </Button>
          )}
        </div>
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
      {activeTab === 'key-metrics' && <KeyMetricsTab />}
      {activeTab === 'revenue' && <RevenueTab />}
      {activeTab === 'benchmarks' && <BenchmarksTab />}
      {activeTab === 'labor' && <LaborTab />}
    </div>
  )
}
