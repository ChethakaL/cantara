'use client'

import { Plus, Trash2 } from 'lucide-react'
import { isMarketingIntakeField, MARKETING_INTAKE_FIELDS, parseMarketingRows, type MarketingIntakeFieldKey } from '@/lib/marketing-intake'

export default function MarketingIntakeRows({
  fieldKey,
  value,
  onChange,
}: {
  fieldKey: string
  value: string
  onChange: (value: string) => void
}) {
  if (!isMarketingIntakeField(fieldKey)) return null
  const columns = MARKETING_INTAKE_FIELDS[fieldKey]
  const parsedRows = parseMarketingRows(value, fieldKey)
  const rows = parsedRows.length ? parsedRows : [Object.fromEntries(columns.map(column => [column.key, '']))]

  function updateCell(rowIndex: number, key: string, nextValue: string) {
    const next = [...rows]
    next[rowIndex] = { ...next[rowIndex], [key]: nextValue }
    onChange(JSON.stringify(next))
  }

  function addRow() {
    onChange(JSON.stringify([...rows, Object.fromEntries(columns.map(column => [column.key, '']))]))
  }

  function removeRow(rowIndex: number) {
    onChange(JSON.stringify(rows.filter((_, index) => index !== rowIndex)))
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="space-y-3">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Row {rowIndex + 1}</span>
              <button type="button" onClick={() => removeRow(rowIndex)} aria-label={`Remove row ${rowIndex + 1}`} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {columns.map(column => (
                <label key={column.key} className="min-w-0">
                  <span className="mb-1 block text-[11px] font-medium text-slate-500">{column.label}</span>
                  {column.inputType === 'select' ? (
                    <select value={row[column.key] ?? ''} onChange={event => updateCell(rowIndex, column.key, event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400">
                      <option value="">Select…</option>
                      {column.options?.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : (
                    <input type={column.inputType ?? 'text'} min={column.inputType === 'number' ? '0' : undefined} step={column.inputType === 'number' ? 'any' : undefined} value={row[column.key] ?? ''} onChange={event => updateCell(rowIndex, column.key, event.target.value)} placeholder={column.placeholder ?? ''} className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400" />
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={addRow} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100">
        <Plus className="h-3.5 w-3.5" /> Add row
      </button>
    </div>
  )
}

