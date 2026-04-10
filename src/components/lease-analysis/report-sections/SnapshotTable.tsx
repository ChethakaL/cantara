'use client'
import { SnapshotRow, RentScheduleRow } from '../../../lib/lease-analysis/types'
import { normalizeSummaryRows } from '@/lib/lease-analysis/report-utils'

interface Props {
  rows: SnapshotRow[]
  rentSchedule?: RentScheduleRow[]
}

export function SnapshotTable({ rows, rentSchedule }: Props) {
  const normalizedRows = normalizeSummaryRows(rows || [])

  if (!normalizedRows.length) {
    return (
      <div className="py-12 text-center text-sm text-slate-400">
        No summary data extracted. The lease document may not have been parsed correctly.
      </div>
    )
  }

  return (
    <div className="space-y-6">
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

      {rentSchedule && rentSchedule.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-3">Rent Schedule</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Lease Year</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Months</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">Per Annum</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">Per Month</th>
                </tr>
              </thead>
              <tbody>
                {rentSchedule.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-xs font-medium text-slate-600">{row.leaseYear}</td>
                    <td className="py-2.5 px-3 text-xs text-slate-600">{row.months}</td>
                    <td className="py-2.5 px-3 text-sm text-slate-800 text-right font-mono">{row.perAnnum}</td>
                    <td className="py-2.5 px-3 text-sm text-slate-800 text-right font-mono">{row.perMonth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
