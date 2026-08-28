'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'

type MonthlyEntry = {
  month: string
  boardingDogs: number
  daycareDogs: number
}

type ComputedMonth = MonthlyEntry & {
  total: number
  utilization: number
}

type OccupancyReport = {
  capacityModel?: {
    totalDailyCapacity?: number
    boardingRuns?: number
    daycareSpots?: number
    groomingStations?: number
    bathingStations?: number
  }
  monthlyData?: MonthlyEntry[]
  computed?: {
    monthlyTotals: ComputedMonth[]
    avgUtilization: number
  }
}

function formatMonthLabel(m: string): string {
  const [year, month] = m.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export function OccupancyDataReview({ clientId }: { clientId: string }) {
  const [report, setReport] = useState<OccupancyReport | null>(null)
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/occupancy-review?clientId=${encodeURIComponent(clientId)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.report) {
          setReport(data.report)
        }
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false)
      })
  }, [clientId])

  if (loading) {
    return (
      <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-500 animate-pulse">
        Loading occupancy review data...
      </div>
    )
  }

  if (!report || (!report.capacityModel && !report.monthlyData?.length)) {
    return null
  }

  return (
    <div className="mb-4 rounded-xl border border-emerald-200/90 bg-emerald-50/40 p-3.5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen(value => !value)}
          className="flex items-center gap-2 text-left text-xs font-bold text-emerald-950 hover:text-emerald-800"
        >
          {open ? <ChevronUp className="h-4 w-4 shrink-0 text-emerald-600" /> : <ChevronDown className="h-4 w-4 shrink-0 text-emerald-600" />}
          <span>Extracted Occupancy Data</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
            <Sparkles className="h-3 w-3" /> Auto-extracted
          </span>
        </button>
      </div>

      {open && (
        <div className="mt-3">
          <div className="mb-3 rounded-lg border border-emerald-200/80 bg-white p-2.5 text-xs leading-relaxed text-emerald-950">
            <p className="flex items-start gap-1.5">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>
                <strong>Auto-derived from Upload:</strong> The capacity model and 24-month data below were automatically extracted from your uploaded documents by the Occupancy Review agent.
              </span>
            </p>
          </div>

          {report.capacityModel && (
            <div className="mb-4 rounded-lg border border-emerald-200/80 bg-white p-3">
              <h4 className="text-xs font-bold text-emerald-900 mb-2">Capacity Model</h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                <div>
                  <span className="block text-slate-500 font-medium">Total Daily Capacity</span>
                  <span className="block font-semibold text-slate-800">{report.capacityModel.totalDailyCapacity || '—'}</span>
                </div>
                <div>
                  <span className="block text-slate-500 font-medium">Boarding Runs</span>
                  <span className="block font-semibold text-slate-800">{report.capacityModel.boardingRuns || '—'}</span>
                </div>
                <div>
                  <span className="block text-slate-500 font-medium">Daycare Spots</span>
                  <span className="block font-semibold text-slate-800">{report.capacityModel.daycareSpots || '—'}</span>
                </div>
                <div>
                  <span className="block text-slate-500 font-medium">Grooming Stations</span>
                  <span className="block font-semibold text-slate-800">{report.capacityModel.groomingStations || '—'}</span>
                </div>
                <div>
                  <span className="block text-slate-500 font-medium">Bathing Stations</span>
                  <span className="block font-semibold text-slate-800">{report.capacityModel.bathingStations || '—'}</span>
                </div>
              </div>
            </div>
          )}

          {report.computed?.monthlyTotals && report.computed.monthlyTotals.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-emerald-200/80 bg-white">
              <table className="min-w-full w-full text-xs">
                <thead>
                  <tr className="border-b border-emerald-100 bg-emerald-50/80 text-emerald-900 font-semibold text-left">
                    <th className="p-2">Month</th>
                    <th className="p-2 text-right">Boarding Dogs</th>
                    <th className="p-2 text-right">Daycare Dogs</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-right">Utilization</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.computed.monthlyTotals.map((row, index) => (
                    <tr key={index} className="hover:bg-emerald-50/30">
                      <td className="p-2 font-medium text-slate-800">{formatMonthLabel(row.month)}</td>
                      <td className="p-2 text-right font-mono">{row.boardingDogs}</td>
                      <td className="p-2 text-right font-mono">{row.daycareDogs}</td>
                      <td className="p-2 text-right font-mono font-semibold text-slate-700">{row.total}</td>
                      <td className="p-2 text-right font-mono">{row.utilization}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
