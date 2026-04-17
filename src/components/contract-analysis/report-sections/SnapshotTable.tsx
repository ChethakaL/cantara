'use client'
import { SnapshotRow } from '../../../lib/contract-analysis/types'

interface Props {
  rows: SnapshotRow[]
}

export function SnapshotTable({ rows }: Props) {
  if (!rows || !rows.length) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No snapshot data extracted. The contract package may not have been parsed correctly.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map((row, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] uppercase tracking-wide text-slate-400">{row.field}</p>
          <p className="text-sm text-slate-800 mt-1 font-medium">{row.finding || <span className="text-slate-300 italic">Not found</span>}</p>
          {row.sourceSection && (
            <p className="text-[10px] text-amber-600 font-mono mt-1">{row.sourceSection}</p>
          )}
        </div>
      ))}
    </div>
  )
}
