'use client'
import { SnapshotRow } from '../../../lib/contract-analysis/types'

interface Props {
  rows: SnapshotRow[]
  executiveSummary?: string
  editMode?: boolean
  onExecutiveSummaryChange?: (value: string) => void
}

export function SnapshotTable({ rows, executiveSummary, editMode, onExecutiveSummaryChange }: Props) {
  if (!rows || !rows.length) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No snapshot data extracted. The contract package may not have been parsed correctly.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-800">Executive Summary</h4>
        {editMode ? (
          <textarea value={executiveSummary || ''} onChange={e => onExecutiveSummaryChange?.(e.target.value)} className="mt-2 min-h-28 w-full rounded-lg border border-amber-200 bg-white p-3 text-sm leading-relaxed text-slate-700" />
        ) : <p className="mt-2 text-sm leading-relaxed text-slate-700">{executiveSummary || 'No executive summary available.'}</p>}
      </section>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {rows.map((row, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Contract {i + 1}</p>
              <h5 className="text-sm font-semibold text-slate-900 mt-1">{row.field}</h5>
            </div>
            {row.sourceSection && (
              <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">
                {row.sourceSection}
              </span>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {row.finding ? (
              splitFinding(row.finding).map((part, index) => (
                <div key={index} className="rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
                  {part}
                </div>
              ))
            ) : (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm italic text-slate-300">Not found</div>
            )}
          </div>
        </div>
      ))}
      </div>
    </div>
  )
}

function splitFinding(value: string): string[] {
  return value
    .split(/\s+\|\s+/)
    .map(part => part.trim())
    .filter(Boolean)
}
