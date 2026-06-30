'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Loader2, RefreshCw, TrendingUp, Upload, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button, Card, cn } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import InlineEditableMarkdownReport from '@/components/report-export/InlineEditableMarkdownReport'
import { buildOccupancyReviewReportHtml } from '@/lib/report-export/build-occupancy-review-report'

type OccupancyReport = {
  clientName: string
  generatedAt: string
  updatedAt?: string
  markdown: string
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
}: {
  clientId: string
  clientName: string
}) {
  const [report, setReport] = useState<OccupancyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form inputs
  const [totalBoardingRuns, setTotalBoardingRuns] = useState('')
  const [totalDaycareSpots, setTotalDaycareSpots] = useState('')
  const [totalGroomingStations, setTotalGroomingStations] = useState('')
  const [analysisPeriod, setAnalysisPeriod] = useState('')

  // File uploads
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/occupancy-review?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setReport(data.report)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load occupancy review.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [clientId])

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles: UploadedFile[] = Array.from(fileList).map(file => ({
      file,
      name: file.name,
      sizeBytes: file.size,
    }))
    setUploadedFiles(prev => [...prev, ...newFiles])
    setError(null)
  }, [])

  const removeFile = (name: string) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== name))
  }

  const analyze = async () => {
    setGenerating(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('clientId', clientId)
      formData.append('clientName', clientName)
      if (totalBoardingRuns) formData.append('totalBoardingRuns', totalBoardingRuns)
      if (totalDaycareSpots) formData.append('totalDaycareSpots', totalDaycareSpots)
      if (totalGroomingStations) formData.append('totalGroomingStations', totalGroomingStations)
      if (analysisPeriod) formData.append('analysisPeriod', analysisPeriod)

      for (const uploaded of uploadedFiles) {
        formData.append('files', uploaded.file)
      }

      const res = await fetch('/api/occupancy-review', {
        method: 'POST',
        body: formData,
      })
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

  const html = useMemo(() =>
    report ? buildOccupancyReviewReportHtml(report) : '',
  [report])

  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  // Report view
  if (report) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">Occupancy Review</h2>
            <p className="text-xs text-slate-500 mt-1">WS2 — Capacity Utilization & Demand Analysis</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setReport(null)}>
              <RefreshCw className="w-3.5 h-3.5" />
              New Analysis
            </Button>
            <ExportReportButton html={html} fileName={`occupancy-review-${clientName.replace(/\s+/g, '-').toLowerCase()}`} label="Export PDF" />
          </div>
        </div>

        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <InlineEditableMarkdownReport
          report={report}
          markdownComponents={markdownComponents}
          onSave={async (markdown) => {
            const res = await fetch('/api/occupancy-review', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ clientId, markdown }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to save occupancy review.')
            setReport(data.report)
          }}
        />
      </div>
    )
  }

  // Generating state
  if (generating) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-bold text-slate-800">Occupancy Review</h2>
          <p className="text-xs text-slate-500 mt-1">WS2 — Capacity Utilization & Demand Analysis</p>
        </div>
        <Card className="p-8">
          <div className="flex items-start gap-4">
            <div className="mt-1 h-5 w-5 rounded-full border-2 border-slate-200 border-t-indigo-500 animate-spin" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-800">Analyzing occupancy data</h3>
              <p className="mt-1 text-sm text-slate-500">
                Reviewing capacity, occupancy rates, seasonal patterns, and benchmarking against industry standards. This takes 30-90 seconds.
              </p>
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

  // Input / upload view
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-800">Occupancy Review</h2>
        <p className="text-xs text-slate-500 mt-1">WS2 — Upload occupancy data and capacity details for AI-powered analysis against pet resort benchmarks.</p>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {/* Capacity inputs */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold text-slate-800">Capacity Information</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Total Boarding Runs / Suites</span>
            <input
              type="number"
              min="0"
              value={totalBoardingRuns}
              onChange={e => setTotalBoardingRuns(e.target.value)}
              placeholder="e.g., 45"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Total Daycare Spots</span>
            <input
              type="number"
              min="0"
              value={totalDaycareSpots}
              onChange={e => setTotalDaycareSpots(e.target.value)}
              placeholder="e.g., 30"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Total Grooming Stations</span>
            <input
              type="number"
              min="0"
              value={totalGroomingStations}
              onChange={e => setTotalGroomingStations(e.target.value)}
              placeholder="e.g., 6"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Analysis Period</span>
            <input
              type="text"
              value={analysisPeriod}
              onChange={e => setAnalysisPeriod(e.target.value)}
              placeholder="e.g., Jan 2024 - Dec 2024"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20"
            />
          </label>
        </div>
      </Card>

      {/* Document upload */}
      <Card className="p-6 space-y-4">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
            <TrendingUp className="w-7 h-7 text-indigo-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Upload Occupancy Data</h3>
          <p className="text-xs text-slate-500 max-w-lg mx-auto">
            Upload CSV, XLSX, or PDF files containing occupancy records, booking reports, daily headcounts, or revenue data for comprehensive analysis.
          </p>
        </div>

        <label className="block border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
          <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
          <span className="text-sm text-slate-600 font-medium">Drop files or click to upload</span>
          <span className="block text-xs text-slate-400 mt-1">PDF, XLSX, CSV</span>
          <input
            type="file"
            multiple
            accept=".pdf,.xlsx,.csv,.xls"
            className="hidden"
            onChange={e => e.target.files && handleFiles(e.target.files)}
          />
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

      <Button
        onClick={analyze}
        disabled={generating}
        className="w-full"
      >
        {generating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing Occupancy...
          </>
        ) : (
          <>
            <TrendingUp className="w-4 h-4" />
            Analyze Occupancy
          </>
        )}
      </Button>
    </div>
  )
}
