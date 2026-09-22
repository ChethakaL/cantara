'use client'
import { SnapshotRow } from '../../../lib/lease-analysis/types'
import { filterSnapshotRowsForBuyerPackage } from '@/lib/lease-analysis/report-utils'

interface Props {
  rows: SnapshotRow[]
  executiveSummary?: string
  editMode?: boolean
  onExecutiveSummaryChange?: (value: string) => void
}

export function SnapshotTable({ rows, executiveSummary, editMode, onExecutiveSummaryChange }: Props) {
  const normalizedRows = filterSnapshotRowsForBuyerPackage(rows || [])

  if (!normalizedRows.length) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No summary data extracted. The lease document may not have been parsed correctly.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-800">Executive Summary</h4>
        {editMode ? (
          <textarea value={executiveSummary || ''} onChange={e => onExecutiveSummaryChange?.(e.target.value)} className="mt-2 min-h-28 w-full rounded-lg border border-amber-200 bg-white p-3 text-sm leading-relaxed text-slate-700" />
        ) : <p className="mt-2 text-sm leading-relaxed text-slate-700">{executiveSummary || 'No executive summary available.'}</p>}
      </section>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 w-48">Key Item</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Finding</th>
            </tr>
          </thead>
          <tbody>
            {normalizedRows.map((row, i) => (
              <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="py-3 px-3 text-xs font-medium text-slate-600 align-top">{row.field}</td>
                <td className="py-3 px-3 text-sm text-slate-800">{row.finding || <span className="text-slate-300 italic">Not found</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
