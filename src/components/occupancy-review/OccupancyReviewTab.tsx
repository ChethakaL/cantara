'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Loader2, RefreshCw, TrendingUp, Upload, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Button, Card, cn } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import InlineEditableMarkdownReport from '@/components/report-export/InlineEditableMarkdownReport'
import { buildOccupancyReviewReportHtml } from '@/lib/report-export/build-occupancy-review-report'

type MonthlyEntry = {
  month: string // 'YYYY-MM'
  boardingDogs: number
  daycareDogs: number
}

type ComputedMonth = MonthlyEntry & {
  total: number
  utilization: number
  boardingMix: number
  daycareMix: number
}

type OccupancyReport = {
  clientName: string
  generatedAt: string
  updatedAt?: string
  markdown: string
  capacityModel?: {
    totalDailyCapacity?: number
    boardingRuns?: number
    daycareSpots?: number
    groomingStations?: number
  }
  monthlyData?: MonthlyEntry[]
  computed?: {
    monthlyTotals: ComputedMonth[]
    peakMonths: string[]
    troughMonths: string[]
    avgUtilization: number
    daycareDisplacementPct: number
    totalCapacity: number
  }
  inputs?: {
    totalBoardingRuns?: string | null
    totalDaycareSpots?: string | null
    totalGroomingStations?: string | null
    analysisPeriod?: string | null
    documentNames?: string[]
  }
}

type UploadedFile = {
  file: File
  name: string
  sizeBytes: number
}

function formatMonthLabel(m: string): string {
  const [year, month] = m.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

function initLast24Months(): MonthlyEntry[] {
  const entries: MonthlyEntry[] = []
  const now = new Date()
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    entries.push({ month, boardingDogs: 0, daycareDogs: 0 })
  }
  return entries
}

function OccupancyChart({ data }: { data: ComputedMonth[] }) {
  const chartData = data.map(m => ({
    month: formatMonthLabel(m.month),
    Boarding: m.boardingDogs,
    Daycare: m.daycareDogs,
  }))
  return (
    <div className="mt-4">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" interval={0} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={(value: number, name: string) => [`${value} dogs`, name]} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="Boarding" stackId="a" fill="#4f46e5" />
          <Bar dataKey="Daycare" stackId="a" fill="#a5b4fc" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-[11px] text-slate-400 text-center mt-1">Stacked: boarding + daycare dogs per month</p>
    </div>
  )
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-5 border-b-2 border-indigo-200 pb-3 text-2xl font-bold tracking-tight text-slate-900">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-3 mt-10 text-lg font-bold tracking-tight text-slate-900 border-b border-slate-200 pb-2">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-6 text-sm font-bold text-slate-800">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-4 text-sm leading-7 text-slate-700">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-bold text-slate-900">{children}</strong>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-5 list-disc space-y-2 pl-5 text-sm text-slate-700 marker:text-indigo-500">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-5 list-decimal space-y-2 pl-5 text-sm text-slate-700 marker:text-indigo-500">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-7">{children}</li>
  ),
  hr: () => <hr className="my-8 border-slate-200" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-6 overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-slate-50">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-t border-slate-100 px-4 py-3 align-top text-sm leading-6 text-slate-700">{children}</td>
  ),
}

export default function OccupancyReviewTab({
  clientId,
  clientName,
  readOnly = false,
}: {
  clientId: string
  clientName: string
  readOnly?: boolean
}) {
  const [report, setReport] = useState<OccupancyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Capacity fields
  const [totalDailyCapacity, setTotalDailyCapacity] = useState('')
  const [boardingRuns, setBoardingRuns] = useState('')
  const [daycareSpotsInput, setDaycareSpotsInput] = useState('')
  const [groomingStations, setGroomingStations] = useState('')

  // 24-month data grid
  const [monthlyData, setMonthlyData] = useState<MonthlyEntry[]>(initLast24Months)

  // File uploads
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const csvInputRef = useRef<HTMLInputElement | null>(null)

  const computedDaycare = useMemo(() => {
    if (daycareSpotsInput) return null // user has entered manually
    const cap = parseInt(totalDailyCapacity)
    const runs = parseInt(boardingRuns)
    if (!isNaN(cap) && !isNaN(runs) && cap > runs) return cap - runs
    return null
  }, [totalDailyCapacity, boardingRuns, daycareSpotsInput])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/occupancy-review?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setReport(data.report)
      const inputs = data.inputs
      // Pre-fill form from saved report or client portal inputs
      if (data.report?.capacityModel) {
        const cm = data.report.capacityModel
        if (cm.totalDailyCapacity) setTotalDailyCapacity(String(cm.totalDailyCapacity))
        if (cm.boardingRuns) setBoardingRuns(String(cm.boardingRuns))
        if (cm.daycareSpots) setDaycareSpotsInput(String(cm.daycareSpots))
        if (cm.groomingStations) setGroomingStations(String(cm.groomingStations))
      } else if (inputs) {
        if (inputs.totalDailyCapacity) setTotalDailyCapacity(String(inputs.totalDailyCapacity))
        if (inputs.boardingRuns) setBoardingRuns(String(inputs.boardingRuns))
        if (inputs.daycareSpots) setDaycareSpotsInput(String(inputs.daycareSpots))
        if (inputs.groomingStations) setGroomingStations(String(inputs.groomingStations))
      }
      if (data.report?.monthlyData?.length) {
        setMonthlyData(data.report.monthlyData)
      } else if (inputs?.monthlyData?.length) {
        const imported = Object.fromEntries(
          inputs.monthlyData.map((entry: MonthlyEntry) => [entry.month, entry])
        )
        setMonthlyData(prev => prev.map(entry => imported[entry.month]
          ? { ...entry, boardingDogs: imported[entry.month].boardingDogs, daycareDogs: imported[entry.month].daycareDogs }
          : entry
        ))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load occupancy review.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [clientId])

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles: UploadedFile[] = Array.from(fileList).map(file => ({
      file, name: file.name, sizeBytes: file.size,
    }))
    setUploadedFiles(prev => [...prev, ...newFiles])
    setError(null)
  }, [])

  const removeFile = (name: string) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== name))
  }

  const handleCsvImport = async (fileList: FileList) => {
    const file = fileList[0]
    if (!file) return
    if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
      setError('For XLSX files, please save as CSV first, then import.')
      return
    }
    const text = await file.text()
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) { setError('CSV appears empty.'); return }
    const splitCsvLine = (line: string) =>
      line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
    const headers = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase())
    const monthIdx = headers.findIndex(h => ['month', 'date', 'period'].includes(h))
    const boardingIdx = headers.findIndex(h => ['boarding', 'boarding dogs', 'boardingdogs', 'boarding_dogs', 'boardings'].includes(h))
    const daycareIdx = headers.findIndex(h => ['daycare', 'daycare dogs', 'daycaredogs', 'daycare_dogs', 'daycares'].includes(h))
    if (monthIdx === -1 || boardingIdx === -1 || daycareIdx === -1) {
      setError('CSV must have columns: Month, Boarding, Daycare')
      return
    }
    const imported: Record<string, {boardingDogs: number; daycareDogs: number}> = {}
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i])
      const rawMonth = cols[monthIdx]?.trim()
      if (!rawMonth) continue
      // Try to parse month
      let monthKey = rawMonth
      if (/^\d{4}-\d{2}$/.test(rawMonth)) {
        monthKey = rawMonth
      } else {
        const d = new Date(rawMonth)
        if (!isNaN(d.getTime())) {
          monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        }
      }
      imported[monthKey] = {
        boardingDogs: parseInt(cols[boardingIdx]) || 0,
        daycareDogs: parseInt(cols[daycareIdx]) || 0,
      }
    }
    setMonthlyData(prev => prev.map(entry => imported[entry.month] 
      ? { ...entry, ...imported[entry.month] } 
      : entry
    ))
    csvInputRef.current && (csvInputRef.current.value = '')
  }

  const updateMonthly = (month: string, field: 'boardingDogs' | 'daycareDogs', value: string) => {
    setMonthlyData(prev => prev.map(m => m.month === month ? { ...m, [field]: parseInt(value) || 0 } : m))
  }

  const analyze = async () => {
    setGenerating(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('clientId', clientId)
      formData.append('clientName', clientName)
      if (totalDailyCapacity) formData.append('totalDailyCapacity', totalDailyCapacity)
      if (boardingRuns) formData.append('boardingRuns', boardingRuns)
      const effectiveDaycare = daycareSpotsInput || (computedDaycare !== null ? String(computedDaycare) : '')
      if (effectiveDaycare) formData.append('daycareSpots', effectiveDaycare)
      if (groomingStations) formData.append('groomingStations', groomingStations)
      formData.append('monthlyData', JSON.stringify(monthlyData.filter(m => m.boardingDogs > 0 || m.daycareDogs > 0)))
      for (const uploaded of uploadedFiles) {
        formData.append('files', uploaded.file)
      }
      const res = await fetch('/api/occupancy-review', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setReport(data.report)
      setUploadedFiles([])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate occupancy review.')
    } finally {
      setGenerating(false)
    }
  }

  const html = useMemo(() => report ? buildOccupancyReviewReportHtml(report) : '', [report])

  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (report) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">Occupancy Review</h2>
            <p className="text-xs text-slate-500 mt-1">WS2 — Buyer-Facing Capacity Utilization Report</p>
          </div>
          <div className="flex items-center gap-2">
            {!readOnly && (
              <Button size="sm" variant="outline" onClick={() => setReport(null)}>
                <RefreshCw className="w-3.5 h-3.5" />
                New Analysis
              </Button>
            )}
            <ExportReportButton html={html} fileName={`occupancy-review-${clientName.replace(/\s+/g, '-').toLowerCase()}`} label="Export PDF" />
          </div>
        </div>

        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        {/* Metrics summary */}
        {report.computed && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Avg Utilization</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{report.computed.avgUtilization}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Peak Months</p>
              <p className="text-sm font-semibold text-slate-700 mt-1 leading-snug">{report.computed.peakMonths.slice(0, 2).map(m => formatMonthLabel(m)).join(', ') || '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Trough Months</p>
              <p className="text-sm font-semibold text-slate-700 mt-1 leading-snug">{report.computed.troughMonths.slice(0, 2).map(m => formatMonthLabel(m)).join(', ') || '—'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Daycare Displacement</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{report.computed.daycareDisplacementPct}%</p>
            </div>
          </div>
        )}

        {/* Chart */}
        {report.computed?.monthlyTotals?.length ? (
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-slate-800 mb-1">24-Month Occupancy — Boarding vs Daycare</h3>
            <OccupancyChart data={report.computed.monthlyTotals} />
          </Card>
        ) : null}

        <InlineEditableMarkdownReport
          report={report}
          markdownComponents={markdownComponents}
          readOnly={readOnly}
          onSave={async (markdown) => {
            const res = await fetch('/api/occupancy-review', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clientId, markdown }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to save.')
            setReport(data.report)
          }}
        />
      </div>
    )
  }

  if (generating) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-bold text-slate-800">Occupancy Review</h2>
          <p className="text-xs text-slate-500 mt-1">WS2 — Generating buyer-facing report...</p>
        </div>
        <Card className="p-8">
          <div className="flex items-start gap-4">
            <div className="mt-1 h-5 w-5 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800">Building buyer-facing occupancy report</h3>
              <p className="mt-1 text-sm text-slate-500">Computing capacity utilization, trade-off analysis, and growth headroom. This takes 30–90 seconds.</p>
              <div className="mt-5 space-y-3">
                <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
                <div className="h-20 w-full animate-pulse rounded-xl bg-slate-50" />
              </div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // Input form
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-800">Occupancy Review</h2>
        <p className="text-xs text-slate-500 mt-1">WS2 — Enter 24-month capacity data for buyer-facing analysis.</p>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {/* Capacity Model */}
      <Card className="p-6 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Capacity Model</h3>
          <p className="text-xs text-slate-400 mt-0.5">Owner-stated total capacity is preferred. Daycare spots = Total − Boarding Runs if left blank.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Total Daily Capacity <span className="text-amber-600 font-bold">(Owner-Stated Max)</span></span>
            <input type="number" min="0" value={totalDailyCapacity} onChange={e => setTotalDailyCapacity(e.target.value)}
              placeholder="e.g., 75"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Boarding Runs / Kennels</span>
            <input type="number" min="0" value={boardingRuns} onChange={e => setBoardingRuns(e.target.value)}
              placeholder="e.g., 45"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Daycare Spots
              {computedDaycare !== null && <span className="text-slate-400 font-normal ml-1">(auto: {computedDaycare})</span>}
            </span>
            <input type="number" min="0" value={daycareSpotsInput} onChange={e => setDaycareSpotsInput(e.target.value)}
              placeholder={computedDaycare !== null ? `Auto: ${computedDaycare}` : 'e.g., 30'}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20" />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Grooming Stations</span>
            <input type="number" min="0" value={groomingStations} onChange={e => setGroomingStations(e.target.value)}
              placeholder="e.g., 6"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20" />
          </label>
        </div>
      </Card>

      {/* 24-month data grid */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">24-Month Monthly Data</h3>
            <p className="text-xs text-slate-400 mt-0.5">Enter dogs per month. Boarding + daycare = total for that month.</p>
          </div>
          <button
            type="button"
            onClick={() => csvInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-indigo-300 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={e => e.target.files && void handleCsvImport(e.target.files)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm table-fixed">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="w-[32%] text-left text-xs font-medium text-slate-500 py-2 pr-4">Month</th>
                <th className="w-[28%] text-center text-xs font-medium text-indigo-600 py-2 px-2">Boarding Dogs</th>
                <th className="w-[28%] text-center text-xs font-medium text-indigo-400 py-2 px-2">Daycare Dogs</th>
                <th className="w-[12%] text-right text-xs font-medium text-slate-400 py-2 pl-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyData.map(m => {
                const total = m.boardingDogs + m.daycareDogs
                return (
                  <tr key={m.month}>
                    <td className="py-1.5 pr-4 text-xs text-slate-600 font-medium">{formatMonthLabel(m.month)}</td>
                    <td className="py-1.5 px-2">
                      <div className="flex justify-center">
                        <input
                          type="number"
                          min="0"
                          value={m.boardingDogs || ''}
                          onChange={e => updateMonthly(m.month, 'boardingDogs', e.target.value)}
                          className="w-full max-w-[96px] rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none text-center focus:border-indigo-400"
                        />
                      </div>
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="flex justify-center">
                        <input
                          type="number"
                          min="0"
                          value={m.daycareDogs || ''}
                          onChange={e => updateMonthly(m.month, 'daycareDogs', e.target.value)}
                          className="w-full max-w-[96px] rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 outline-none text-center focus:border-indigo-400"
                        />
                      </div>
                    </td>
                    <td className="py-1.5 pl-2 text-right text-xs font-semibold text-slate-600">{total > 0 ? total : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Optional file upload */}
      <Card className="p-6 space-y-4">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <TrendingUp className="w-7 h-7 text-indigo-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Optional: Upload Supporting Documents</h3>
          <p className="text-xs text-slate-500 max-w-lg mx-auto">Upload CSV, XLSX, or PDF for additional context. Monthly grid above is the primary data source.</p>
        </div>
        <label className="block border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
          <Upload className="w-5 h-5 text-slate-400 mx-auto mb-2" />
          <span className="text-sm text-slate-600 font-medium">Drop files or click to upload</span>
          <span className="block text-xs text-slate-400 mt-1">PDF, XLSX, CSV</span>
          <input type="file" multiple accept=".pdf,.xlsx,.csv,.xls" className="hidden" onChange={e => e.target.files && handleFiles(e.target.files)} />
        </label>
        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            {uploadedFiles.map(f => (
              <div key={f.name} className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-700 flex-1 truncate">{f.name}</span>
                <span className="text-xs text-slate-400">{(f.sizeBytes / 1024).toFixed(0)} KB</span>
                <button onClick={() => removeFile(f.name)} className="text-slate-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Button onClick={analyze} disabled={generating} className="w-full">
        {generating ? (
          <><Loader2 className="w-4 h-4 animate-spin" />Analyzing Occupancy...</>
        ) : (
          <><TrendingUp className="w-4 h-4" />Generate Buyer-Facing Occupancy Report</>
        )}
      </Button>
    </div>
  )
}
