'use client'

import { useCallback, useMemo, useState } from 'react'
import { Badge, Button, Card } from '@/components/ui'

// ── Types ────────────────────────────────────────────────────────────────────

/** Shape of the LLM extraction stored at analysis.normalizedData.llmExtraction */
interface LlmExtractionPeriod {
  label: string
  startMonth: string
  endMonth: string
}

interface RevenueBreakdownItem {
  category: string
  amount: number
}

interface ExpenseBreakdownItem {
  category: string
  amount: number
  cantaraCode: string | null
}

interface LlmAnnualData {
  period: string
  revenue: number
  cogs: number
  grossProfit: number
  totalOpEx: number
  netIncome: number
  revenueBreakdown: RevenueBreakdownItem[]
  expenseBreakdown: ExpenseBreakdownItem[]
}

export interface LlmExtraction {
  periods: LlmExtractionPeriod[]
  annualData: LlmAnnualData[]
  glMapping: Array<{ accountName: string; cantaraCode: string; confidence: number }>
}

/** Flat key to identify an editable cell: "rowKey::periodIndex" */
export type NormOverrides = Record<string, number>

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '--'
  const abs = Math.abs(v)
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return v < 0 ? `($${formatted})` : `$${formatted}`
}

function parseInput(raw: string): number | null {
  const cleaned = raw.replace(/[$,()]/g, '').trim()
  if (!cleaned || isNaN(Number(cleaned))) return null
  return Number(cleaned)
}

// ── Row definition ───────────────────────────────────────────────────────────

type RowKind = 'header' | 'item' | 'subtotal'

interface TableRow {
  key: string
  label: string
  kind: RowKind
  badge?: string | null
  values: (number | null)[] // one per period
}

function buildRows(extraction: LlmExtraction): TableRow[] {
  const rows: TableRow[] = []
  const periods = extraction.annualData

  // Revenue header
  rows.push({ key: 'hdr_revenue', label: 'Revenue', kind: 'header', values: periods.map(() => null) })

  // Revenue breakdown — union all categories across periods
  const revCategories = Array.from(new Set(periods.flatMap((p) => p.revenueBreakdown.map((r) => r.category))))
  for (const cat of revCategories) {
    rows.push({
      key: `rev_${cat}`,
      label: cat,
      kind: 'item',
      values: periods.map((p) => p.revenueBreakdown.find((r) => r.category === cat)?.amount ?? 0),
    })
  }

  // Total Revenue
  rows.push({
    key: 'total_revenue',
    label: 'Total Revenue',
    kind: 'subtotal',
    values: periods.map((p) => p.revenue),
  })

  // COGS
  rows.push({ key: 'hdr_cogs', label: 'Cost of Goods Sold', kind: 'header', values: periods.map(() => null) })
  rows.push({
    key: 'cogs',
    label: 'Cost of Goods Sold',
    kind: 'item',
    values: periods.map((p) => p.cogs),
  })

  // Gross Profit
  rows.push({
    key: 'gross_profit',
    label: 'Gross Profit',
    kind: 'subtotal',
    values: periods.map((p) => p.grossProfit),
  })

  // OpEx header
  rows.push({ key: 'hdr_opex', label: 'Operating Expenses', kind: 'header', values: periods.map(() => null) })

  // Expense breakdown — union all categories across periods
  const expCategories = Array.from(new Set(periods.flatMap((p) => p.expenseBreakdown.map((e) => e.category))))
  for (const cat of expCategories) {
    const sample = periods.flatMap((p) => p.expenseBreakdown).find((e) => e.category === cat)
    rows.push({
      key: `exp_${cat}`,
      label: cat,
      kind: 'item',
      badge: sample?.cantaraCode ?? null,
      values: periods.map((p) => p.expenseBreakdown.find((e) => e.category === cat)?.amount ?? 0),
    })
  }

  // Total OpEx
  rows.push({
    key: 'total_opex',
    label: 'Total Operating Expenses',
    kind: 'subtotal',
    values: periods.map((p) => p.totalOpEx),
  })

  // Net Income
  rows.push({
    key: 'net_income',
    label: 'Net Income (Pre-Normalized)',
    kind: 'subtotal',
    values: periods.map((p) => p.netIncome),
  })

  return rows
}

// ── Component ────────────────────────────────────────────────────────────────

export function Ws21NormSchedule({
  extraction,
  overrides,
  onOverridesChange,
}: {
  extraction: LlmExtraction
  overrides: NormOverrides
  onOverridesChange: (next: NormOverrides) => void
}) {
  const [editingCell, setEditingCell] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const rows = useMemo(() => buildRows(extraction), [extraction])

  const periodLabels = useMemo(
    () => extraction.annualData.map((d) => d.period),
    [extraction],
  )

  const overrideCount = Object.keys(overrides).length

  const cellKey = (rowKey: string, periodIdx: number) => `${rowKey}::${periodIdx}`

  const getCellValue = useCallback(
    (rowKey: string, periodIdx: number, original: number | null): number | null => {
      const key = cellKey(rowKey, periodIdx)
      if (key in overrides) return overrides[key]
      return original
    },
    [overrides],
  )

  const startEdit = (key: string, currentValue: number | null) => {
    setEditingCell(key)
    setEditValue(currentValue !== null ? String(currentValue) : '')
  }

  const commitEdit = (rowKey: string, periodIdx: number, originalValue: number | null) => {
    const key = cellKey(rowKey, periodIdx)
    const parsed = parseInput(editValue)
    if (parsed !== null && parsed !== originalValue) {
      onOverridesChange({ ...overrides, [key]: parsed })
    } else if (parsed === originalValue) {
      // Revert to original — remove override
      const next = { ...overrides }
      delete next[key]
      onOverridesChange(next)
    }
    setEditingCell(null)
    setEditValue('')
  }

  const resetAll = () => {
    onOverridesChange({})
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-3">
        <h4 className="text-sm font-semibold text-slate-800">Normalization Schedule Preview</h4>
        <p className="text-xs text-slate-400 mt-0.5">
          Review and edit the P&L data extracted by the AI before proceeding
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left px-4 py-2 font-semibold text-slate-600 border-b border-r border-slate-200 min-w-[260px]">
                Item Description
              </th>
              {periodLabels.map((label) => (
                <th
                  key={label}
                  className="text-right px-4 py-2 font-semibold text-slate-600 border-b border-r border-slate-200 min-w-[130px]"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.kind === 'header') {
                return (
                  <tr key={row.key} className="bg-slate-100/70">
                    <td
                      colSpan={periodLabels.length + 1}
                      className="px-4 py-2 font-bold text-slate-700 border-b border-slate-200 text-[11px] uppercase tracking-wide"
                    >
                      {row.label}
                    </td>
                  </tr>
                )
              }

              const isSubtotal = row.kind === 'subtotal'

              return (
                <tr
                  key={row.key}
                  className={
                    isSubtotal
                      ? 'border-t-2 border-slate-300 bg-slate-50/50'
                      : 'hover:bg-slate-50/40'
                  }
                >
                  <td
                    className={`px-4 py-1.5 border-b border-r border-slate-200 ${
                      isSubtotal ? 'font-bold text-slate-800' : 'text-slate-600 pl-8'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {row.label}
                      {row.badge && (
                        <Badge color="blue" className="text-[9px] px-1.5 py-0">
                          {row.badge}
                        </Badge>
                      )}
                    </span>
                  </td>
                  {row.values.map((originalVal, pIdx) => {
                    const key = cellKey(row.key, pIdx)
                    const displayVal = getCellValue(row.key, pIdx, originalVal)
                    const isOverridden = key in overrides
                    const isEditing = editingCell === key

                    if (isEditing) {
                      return (
                        <td
                          key={key}
                          className="px-1 py-0.5 border-b border-r border-slate-200 bg-amber-50"
                        >
                          <input
                            type="text"
                            autoFocus
                            className="w-full text-right text-xs px-2 py-1 border border-amber-300 rounded outline-none focus:ring-1 focus:ring-amber-200 bg-white"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={() => commitEdit(row.key, pIdx, originalVal)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit(row.key, pIdx, originalVal)
                              if (e.key === 'Escape') {
                                setEditingCell(null)
                                setEditValue('')
                              }
                            }}
                          />
                        </td>
                      )
                    }

                    return (
                      <td
                        key={key}
                        className={`text-right px-4 py-1.5 border-b border-r border-slate-200 cursor-pointer transition-colors ${
                          isSubtotal ? 'font-bold text-slate-800' : 'text-slate-700'
                        } ${isOverridden ? 'bg-amber-50' : ''} hover:bg-amber-50/60`}
                        onClick={() => {
                          if (row.kind !== 'header') {
                            startEdit(key, displayVal)
                          }
                        }}
                        title={isOverridden ? `Original: ${fmt$(originalVal)}` : 'Click to edit'}
                      >
                        {fmt$(displayVal)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-3">
          {overrideCount > 0 ? (
            <Badge color="gold">{overrideCount} cell{overrideCount !== 1 ? 's' : ''} edited</Badge>
          ) : (
            <span className="text-xs text-slate-400">No edits yet -- click any value to override</span>
          )}
        </div>
        {overrideCount > 0 && (
          <Button variant="outline" size="sm" onClick={resetAll}>
            Reset All
          </Button>
        )}
      </div>
    </Card>
  )
}
