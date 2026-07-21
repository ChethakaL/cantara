'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle, Plus, Trash2, RotateCcw, Sparkles, AlertCircle } from 'lucide-react'

export type RevenueRow = { label: string; fy1: number; fy2: number; fy3: number; ttm: number }

const DEFAULT_STARTER_ROWS: RevenueRow[] = [
  { label: 'Boarding', fy1: 0, fy2: 0, fy3: 0, ttm: 0 },
  { label: 'Daycare', fy1: 0, fy2: 0, fy3: 0, ttm: 0 },
  { label: 'Grooming', fy1: 0, fy2: 0, fy3: 0, ttm: 0 },
  { label: 'Training', fy1: 0, fy2: 0, fy3: 0, ttm: 0 },
  { label: 'Retail & Other', fy1: 0, fy2: 0, fy3: 0, ttm: 0 },
]

export function RevenueBreakdownReview({ clientId }: { clientId: string }) {
  const [rows, setRows] = useState<RevenueRow[]>([])
  const [derivedRows, setDerivedRows] = useState<RevenueRow[]>([])
  const [open, setOpen] = useState(true)
  const [source, setSource] = useState<'client' | 'p&l' | null>(null)
  const [hasPlData, setHasPlData] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    void fetch(`/api/client-portal/revenue-breakdown?clientId=${encodeURIComponent(clientId)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) {
          const loadedRows: RevenueRow[] = data.rows ?? []
          const derived: RevenueRow[] = data.derivedRows ?? []
          setDerivedRows(derived)
          setHasPlData(Boolean(data.hasPlData))
          setSource(data.source ?? null)

          if (loadedRows.length > 0) {
            setRows(loadedRows)
          } else if (derived.length > 0) {
            setRows(derived)
          } else {
            setRows(DEFAULT_STARTER_ROWS)
          }
        }
      })
      .catch(() => {
        setRows(DEFAULT_STARTER_ROWS)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [clientId])

  const updateRow = (index: number, key: keyof RevenueRow, value: string) => {
    setRows(current =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row
        if (key === 'label') return { ...row, label: value }
        const num = Number(value.replace(/[^0-9.-]/g, '')) || 0
        return { ...row, [key]: num }
      })
    )
    setSaved(false)
  }

  const addRow = () => {
    setRows(current => [...current, { label: '', fy1: 0, fy2: 0, fy3: 0, ttm: 0 }])
    setSaved(false)
  }

  const removeRow = (index: number) => {
    setRows(current => current.filter((_, i) => i !== index))
    setSaved(false)
  }

  const resetToPl = () => {
    if (derivedRows.length > 0) {
      setRows(derivedRows)
      setSource('p&l')
      setSaved(false)
    }
  }

  const confirm = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/client-data/${encodeURIComponent(clientId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'revenueBreakdown', data: rows }),
      })
      if (res.ok) {
        setSource('client')
        setSaved(true)
      }
    } finally {
      setSaving(false)
    }
  }

  const totalTtm = rows.reduce((sum, r) => sum + (r.ttm || 0), 0)
  const totalFy1 = rows.reduce((sum, r) => sum + (r.fy1 || 0), 0)
  const totalFy2 = rows.reduce((sum, r) => sum + (r.fy2 || 0), 0)
  const totalFy3 = rows.reduce((sum, r) => sum + (r.fy3 || 0), 0)

  const formatCurrency = (val: number) =>
    val ? `$${Math.round(val).toLocaleString()}` : '$0'

  if (loading) {
    return (
      <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-500 animate-pulse">
        Loading revenue breakdown...
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-xl border border-emerald-200/90 bg-emerald-50/40 p-3.5 shadow-sm">
      {/* Header button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          className="flex items-center gap-2 text-left text-xs font-bold text-emerald-950 hover:text-emerald-800"
        >
          {open ? <ChevronUp className="h-4 w-4 shrink-0 text-emerald-600" /> : <ChevronDown className="h-4 w-4 shrink-0 text-emerald-600" />}
          <span>Revenue Breakdown by Service Line</span>
          {source === 'p&l' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
              <Sparkles className="h-3 w-3" /> Auto-extracted from P&L
            </span>
          )}
          {source === 'client' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-semibold text-white">
              <CheckCircle className="h-3 w-3" /> Confirmed
            </span>
          )}
          {!source && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700">
              Draft / Manual Entry
            </span>
          )}
        </button>

        {open && hasPlData && derivedRows.length > 0 && source === 'client' && (
          <button
            type="button"
            onClick={resetToPl}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-900"
          >
            <RotateCcw className="h-3 w-3" /> Reset to P&L Extracted
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3">
          <div className="mb-3 rounded-lg border border-emerald-200/80 bg-white p-2.5 text-xs leading-relaxed text-emerald-950">
            {source === 'p&l' ? (
              <p className="flex items-start gap-1.5">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span>
                  <strong>Auto-derived from P&L:</strong> The values below were automatically extracted from your 36-month P&L (GL codes open). Please review, adjust if necessary, and click <strong>Confirm Revenue Breakdown</strong>.
                </span>
              </p>
            ) : source === 'client' ? (
              <p className="flex items-start gap-1.5 text-emerald-900">
                <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                <span>
                  <strong>Confirmed Revenue Breakdown:</strong> You can modify any row, add new service lines, or click <strong>Confirm Revenue Breakdown</strong> to re-save.
                </span>
              </p>
            ) : (
              <p className="flex items-start gap-1.5 text-slate-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                <span>
                  When you upload a 36-month P&L with GL codes open, revenue service lines are automatically extracted. You can also manually enter your revenue breakdown below and click <strong>Confirm Revenue Breakdown</strong>.
                </span>
              </p>
            )}
          </div>

          <div className="overflow-x-auto rounded-lg border border-emerald-200/80 bg-white">
            <table className="min-w-[650px] w-full text-xs">
              <thead>
                <tr className="border-b border-emerald-100 bg-emerald-50/80 text-emerald-900 font-semibold text-left">
                  <th className="p-2">Service Line</th>
                  <th className="p-2 w-24">FY1 ($)</th>
                  <th className="p-2 w-24">FY2 ($)</th>
                  <th className="p-2 w-24">FY3 ($)</th>
                  <th className="p-2 w-28">TTM ($)</th>
                  <th className="p-2 w-24">% of TTM</th>
                  <th className="p-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const pct = totalTtm > 0 && row.ttm ? Math.round((row.ttm / totalTtm) * 100) : 0
                  return (
                    <tr key={index} className="border-t border-slate-100 hover:bg-emerald-50/30">
                      <td className="p-1.5">
                        <input
                          type="text"
                          value={row.label}
                          placeholder="e.g. Boarding"
                          onChange={e => updateRow(index, 'label', e.target.value)}
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:border-emerald-500 focus:outline-none"
                        />
                      </td>
                      {(['fy1', 'fy2', 'fy3', 'ttm'] as const).map(field => (
                        <td key={field} className="p-1.5">
                          <input
                            type="text"
                            value={row[field] ? String(row[field]) : ''}
                            placeholder="0"
                            onChange={e => updateRow(index, field, e.target.value)}
                            className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-mono text-slate-800 focus:border-emerald-500 focus:outline-none"
                          />
                        </td>
                      ))}
                      <td className="p-1.5 text-slate-500 font-mono text-xs">
                        {pct > 0 ? `${pct}%` : '—'}
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="text-slate-400 hover:text-red-600 transition-colors p-1"
                          title="Remove service line"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-emerald-200 bg-emerald-50/60 font-bold text-emerald-950">
                  <td className="p-2">Total Revenue</td>
                  <td className="p-2 font-mono text-xs">{formatCurrency(totalFy1)}</td>
                  <td className="p-2 font-mono text-xs">{formatCurrency(totalFy2)}</td>
                  <td className="p-2 font-mono text-xs">{formatCurrency(totalFy3)}</td>
                  <td className="p-2 font-mono text-xs text-emerald-700">{formatCurrency(totalTtm)}</td>
                  <td className="p-2 font-mono text-xs">100%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300"
            >
              <Plus className="h-3.5 w-3.5 text-slate-500" /> Add Service Line
            </button>

            <div className="flex items-center gap-2">
              {saved && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle className="h-3.5 w-3.5" /> Saved & Confirmed
                </span>
              )}
              <button
                type="button"
                onClick={() => void confirm()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 shadow-sm disabled:opacity-50"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Confirm Revenue Breakdown'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
