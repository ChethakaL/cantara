'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileText,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCw,
  RotateCw,
  Save,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Button, Card, cn } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import InlineEditableMarkdownReport from '@/components/report-export/InlineEditableMarkdownReport'
import { buildOccupancyReviewReportHtml } from '@/lib/report-export/build-occupancy-review-report'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'

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
    bathingStations?: number
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

function DeleteConfirmModal({
  open,
  title,
  description,
  onClose,
  onConfirm,
  confirmLabel = 'Delete',
  isDeleting = false,
}: {
  open: boolean
  title: string
  description: string
  onClose: () => void
  onConfirm: () => void
  confirmLabel?: string
  isDeleting?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isDeleting} className="text-xs cursor-pointer">
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="text-xs bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
          >
            {isDeleting ? 'Deleting...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusToast({
  toast,
  onClose,
}: {
  toast: { message: string; type: 'success' | 'error' | 'info' } | null
  onClose: () => void
}) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onClose, 3500)
    return () => clearTimeout(timer)
  }, [toast, onClose])

  if (!toast) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-lg border shadow-lg text-xs font-medium bg-white text-slate-800 border-slate-200 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
      {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
      {toast.type === 'info' && <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />}
      <span>{toast.message}</span>
      <button onClick={onClose} className="ml-2 text-slate-400 hover:text-slate-600 cursor-pointer">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

interface OccupancyDocumentSlot {
  key: string
  documentId: string
  label: string
  note: string
  required: boolean
  accept: string
  isSpreadsheet: boolean
}

const OCCUPANCY_DOCUMENT_SLOTS: OccupancyDocumentSlot[] = [
  {
    key: 'occupancy_review',
    documentId: 'occupancy_review',
    label: 'Occupancy Review & Booking Records',
    note: 'PawPartner / Gingr exports, monthly booking logs, or capacity statements for the last 24 months. Automatically parsed into capacity model and monthly grid above.',
    required: true,
    accept: '.csv,.xlsx,.xls,.pdf',
    isSpreadsheet: true,
  },
  {
    key: 'occupancy_supporting',
    documentId: 'occupancy_supporting',
    label: 'Additional Supporting Documents & Capacity Statements',
    note: 'Kennel layout schematics, floor plans, municipal capacity permits, or supplementary software exports.',
    required: false,
    accept: '.pdf,.xlsx,.csv,.xls,.docx,.png,.jpg,.jpeg',
    isSpreadsheet: false,
  },
]

function OccupancySlotRow({
  slot,
  docs,
  onUpload,
  onDelete,
  uploading,
  readOnly,
}: {
  slot: OccupancyDocumentSlot
  docs: Array<{ id: string; fileName: string; viewUrl?: string; createdAt?: string }>
  onUpload: (documentId: string, files: FileList | null) => Promise<void>
  onDelete: (docId: string) => Promise<void>
  uploading: boolean
  readOnly?: boolean
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasFiles = docs.length > 0

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all shadow-2xs',
        hasFiles ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200/80 bg-white',
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={slot.accept}
        multiple
        className="hidden"
        onChange={e => {
          void onUpload(slot.documentId, e.target.files)
          e.target.value = ''
        }}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                hasFiles ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400',
              )}
            >
              {slot.isSpreadsheet ? (
                <FileSpreadsheet className="w-4.5 h-4.5" />
              ) : (
                <FileText className="w-4.5 h-4.5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-800">{slot.label}</p>
                <span
                  className={cn(
                    'text-[10px] font-medium px-2 py-0.5 rounded-md border',
                    slot.required
                      ? 'bg-amber-100 text-amber-900 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200',
                  )}
                >
                  {slot.required ? 'Required' : 'Optional'}
                </span>
                {hasFiles ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Uploaded
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-50 text-slate-400 border border-slate-200">
                    Not provided
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{slot.note}</p>

              {/* Uploaded files display */}
              {hasFiles ? (
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {docs.map(doc => (
                    <div
                      key={doc.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-emerald-200 text-emerald-900 shadow-2xs hover:bg-emerald-50 transition-colors"
                    >
                      <a
                        href={doc.viewUrl || `/api/client-documents/download?id=${encodeURIComponent(doc.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 hover:underline"
                        title="Click to view file"
                      >
                        {slot.isSpreadsheet ? (
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        )}
                        <span className="truncate max-w-[240px]">{doc.fileName}</span>
                        {doc.createdAt && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            &middot; {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </a>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => void onDelete(doc.id)}
                          className="ml-1 text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                          title="Remove file"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-1.5">
                  {slot.required
                    ? 'Not provided yet (required — client will upload in client portal or advisor can upload above)'
                    : 'Not provided yet (optional — analysis runs with or without supporting files)'}
                </p>
              )}
            </div>
          </div>
        </div>

        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="h-8 text-xs gap-1.5 shrink-0 cursor-pointer"
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5" />
                {hasFiles ? '+ Add more' : '+ Upload'}
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
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
  const [composingNew, setComposingNew] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [savingInputs, setSavingInputs] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const { provider, setProvider } = useAgentAiProvider()
  const {
    runs,
    historyItems,
    activeRun,
    activeId,
    setActiveId,
    reload: reloadRuns,
    loading: loadingRuns,
  } = useGenericAgentRuns(clientId, AGENT_RUN_KEYS.occupancyReview)

  // Capacity fields
  const [totalDailyCapacity, setTotalDailyCapacity] = useState('')
  const [boardingRuns, setBoardingRuns] = useState('')
  const [daycareSpotsInput, setDaycareSpotsInput] = useState('')
  const [groomingStations, setGroomingStations] = useState('')
  const [bathingStations, setBathingStations] = useState('')

  // 24-month data grid
  const [monthlyData, setMonthlyData] = useState<MonthlyEntry[]>(initLast24Months)

  // File uploads
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [clientDocs, setClientDocs] = useState<Array<{ id: string; documentId?: string; fileName: string; viewUrl?: string; createdAt: string }>>([])
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null)
  const csvInputRef = useRef<HTMLInputElement | null>(null)

  const handleUploadSlotDoc = async (documentId: string, files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadingSlot(documentId)
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const formData = new FormData()
        formData.append('file', file)
        formData.append('clientId', clientId)
        formData.append('documentId', documentId)
        const res = await fetch('/api/client-documents/upload', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const errText = await res.text()
          throw new Error(errText || 'Upload failed')
        }
      }
      await load()
      showToast(
        documentId === 'occupancy_review'
          ? 'Occupancy review file uploaded and parsed into table'
          : 'Supporting document uploaded successfully',
        'success',
      )
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error')
    } finally {
      setUploadingSlot(null)
    }
  }

  const handleDeleteSlotDoc = async (docId: string) => {
    try {
      const res = await fetch('/api/client-documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, recordId: docId }),
      })
      if (!res.ok) throw new Error('Failed to delete document')
      await load()
      showToast('Document removed', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to remove document', 'error')
    }
  }

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
    setToast({ message, type })
  }

  const computedDaycare = useMemo(() => {
    if (daycareSpotsInput) return null // user has entered manually
    const cap = parseInt(totalDailyCapacity)
    const runs = parseInt(boardingRuns)
    if (!isNaN(cap) && !isNaN(runs) && cap > runs) return cap - runs
    return null
  }, [totalDailyCapacity, boardingRuns, daycareSpotsInput])

  const loadPortalDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/occupancy-review?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setClientDocs(data.clientDocs || [])
    } catch {
      // Keep any previously loaded portal docs.
    }
  }, [clientId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/occupancy-review?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setReport(data.report)
      setClientDocs(data.clientDocs || [])
      const inputs = data.inputs
      const cm = data.report?.capacityModel
      const totalDaily = inputs?.totalDailyCapacity ?? cm?.totalDailyCapacity
      const bRuns = inputs?.boardingRuns ?? cm?.boardingRuns
      const dSpots = inputs?.daycareSpots ?? cm?.daycareSpots
      const gStations = inputs?.groomingStations ?? cm?.groomingStations
      const bStations = inputs?.bathingStations ?? cm?.bathingStations

      if (totalDaily != null) setTotalDailyCapacity(String(totalDaily))
      if (bRuns != null) setBoardingRuns(String(bRuns))
      if (dSpots != null) setDaycareSpotsInput(String(dSpots))
      if (gStations != null) setGroomingStations(String(gStations))
      if (bStations != null) setBathingStations(String(bStations))
      if (data.report?.monthlyData?.length) {
        setMonthlyData(data.report.monthlyData)
      } else if (inputs?.monthlyData?.length) {
        setMonthlyData(inputs.monthlyData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load occupancy review.')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    if (loadingRuns) return
    // Always hydrate portal uploads, even when an existing agent run is selected.
    // Previously we returned early for activeRun and left clientDocs stuck at [].
    void loadPortalDocs()
    if (activeRun?.report) {
      const payload = activeRun.report as OccupancyReport
      setReport(payload)
      const cm = payload?.capacityModel
      const inputs = payload?.inputs
      if (cm?.totalDailyCapacity != null) setTotalDailyCapacity(String(cm.totalDailyCapacity))
      if (cm?.boardingRuns != null) setBoardingRuns(String(cm.boardingRuns))
      if (cm?.daycareSpots != null) setDaycareSpotsInput(String(cm.daycareSpots))
      if (cm?.groomingStations != null) setGroomingStations(String(cm.groomingStations))
      if (cm?.bathingStations != null) setBathingStations(String(cm.bathingStations))
      if (inputs?.totalBoardingRuns != null) setBoardingRuns(String(inputs.totalBoardingRuns))
      if (inputs?.totalDaycareSpots != null) setDaycareSpotsInput(String(inputs.totalDaycareSpots))
      if (inputs?.totalGroomingStations != null) setGroomingStations(String(inputs.totalGroomingStations))
      if (payload?.monthlyData?.length) setMonthlyData(payload.monthlyData)
      setLoading(false)
      return
    }
    void load()
  }, [activeRun, loadingRuns, load, loadPortalDocs])

  function selectRun(run: AgentRunHistoryItem) {
    setActiveId(run.id)
    const full = runs.find((item) => item.id === run.id)
    const payload = (full?.report ?? null) as OccupancyReport | null
    if (payload) {
      setReport(payload)
      setComposingNew(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await load()
      showToast('Occupancy inputs & documents refreshed from Client Portal', 'success')
    } catch {
      showToast('Failed to refresh data', 'error')
    } finally {
      setRefreshing(false)
    }
  }

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

  const handleCsvImport = async (fileList: FileList) => {
    const file = fileList[0]
    if (!file) return
    if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
      setError('For XLSX files, please save as CSV first, then import.')
      return
    }
    const text = await file.text()
    const lines = text.trim().split(/\r?\n/)
    if (lines.length < 2) {
      setError('CSV appears empty.')
      return
    }
    const splitCsvLine = (line: string) =>
      line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
    const headers = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase())

    // ─── FORMAT 1: PawPartner daily export ───────────────────────────
    const isPawPartner = headers.some(h => h.includes('day start') || h.includes('kennel occupancy') || h.includes('pet occupancy'))
    if (isPawPartner) {
      const dayEndIdx = headers.findIndex(h => h.includes('day end'))
      const daycareIdx = headers.findIndex(h => h === 'daycare')
      const groomingIdx = headers.findIndex(h => h.includes('grooming'))
      const kennelOccIdx = headers.findIndex(h => h.includes('kennel occupancy'))
      const daycareOccIdx = headers.findIndex(h => h.includes('daycare pet occupancy') || h.includes('daycare occupancy'))

      const monthlyAgg: Record<string, { totalBoarding: number; totalDaycare: number; days: number; totalGrooming: number; avgKennelOcc: number[] }> = {}
      let estimatedBoardingCapacities: number[] = []
      let estimatedDaycareCapacities: number[] = []

      for (let i = 1; i < lines.length; i++) {
        const cols = splitCsvLine(lines[i])
        const label = cols[0]?.trim()
        if (!label || label.toLowerCase() === 'average') continue

        const dateMatch = label.match(/\w+\s+(\d+)\/(\d+)/)
        if (!dateMatch) continue
        const monthNum = parseInt(dateMatch[1])
        const year = new Date().getFullYear()
        const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`

        if (!monthlyAgg[monthKey]) {
          monthlyAgg[monthKey] = { totalBoarding: 0, totalDaycare: 0, days: 0, totalGrooming: 0, avgKennelOcc: [] }
        }

        const dayEnd = parseInt(cols[dayEndIdx]) || 0
        const daycare = cols[daycareIdx]?.trim()
        const daycareNum = daycare && daycare !== '-' ? parseInt(daycare) || 0 : 0
        const grooming = cols[groomingIdx]?.trim()
        const groomingNum = grooming && grooming !== '-' ? parseInt(grooming) || 0 : 0
        const kennelOcc = cols[kennelOccIdx]?.trim()
        const kennelOccNum = kennelOcc ? parseFloat(kennelOcc.replace('%', '')) : 0

        const daycareOcc = daycareOccIdx !== -1 ? cols[daycareOccIdx]?.trim() : null
        const daycareOccNum = daycareOcc && daycareOcc !== '-' ? parseFloat(daycareOcc.replace('%', '')) : 0

        monthlyAgg[monthKey].totalBoarding += dayEnd
        monthlyAgg[monthKey].totalDaycare += daycareNum
        monthlyAgg[monthKey].totalGrooming += groomingNum
        monthlyAgg[monthKey].days++

        if (kennelOccNum > 0) {
          monthlyAgg[monthKey].avgKennelOcc.push(kennelOccNum)
          if (dayEnd > 0) {
            estimatedBoardingCapacities.push(dayEnd / (kennelOccNum / 100))
          }
        }

        if (daycareOccNum > 0 && daycareNum > 0) {
          estimatedDaycareCapacities.push(daycareNum / (daycareOccNum / 100))
        }
      }

      const imported: Record<string, { boardingDogs: number; daycareDogs: number }> = {}
      for (const [month, agg] of Object.entries(monthlyAgg)) {
        imported[month] = {
          boardingDogs: agg.days > 0 ? Math.round(agg.totalBoarding / agg.days) : 0,
          daycareDogs: agg.days > 0 ? Math.round(agg.totalDaycare / agg.days) : 0,
        }
      }

      setMonthlyData(prev => prev.map(entry => imported[entry.month]
        ? { ...entry, ...imported[entry.month] }
        : entry,
      ))

      let finalBoardingRuns = 0
      let finalDaycareSpots = 0

      if (estimatedBoardingCapacities.length > 0) {
        finalBoardingRuns = Math.round(estimatedBoardingCapacities.reduce((a, b) => a + b, 0) / estimatedBoardingCapacities.length)
        setBoardingRuns(String(finalBoardingRuns))
      }

      if (estimatedDaycareCapacities.length > 0) {
        finalDaycareSpots = Math.round(estimatedDaycareCapacities.reduce((a, b) => a + b, 0) / estimatedDaycareCapacities.length)
        setDaycareSpotsInput(String(finalDaycareSpots))
      }

      if (finalBoardingRuns > 0 || finalDaycareSpots > 0) {
        setTotalDailyCapacity(String(finalBoardingRuns + finalDaycareSpots))
      }

      setUploadedFiles(prev => [...prev, { name: file.name, file, sizeBytes: file.size }])
      csvInputRef.current && (csvInputRef.current.value = '')
      showToast('Imported PawPartner daily export into 24-month occupancy table', 'success')
      return
    }

    // ─── FORMAT 2: Standard monthly CSV (Month, Boarding, Daycare) ───
    const monthIdx = headers.findIndex(h => ['month', 'date', 'period', ''].includes(h))
    const boardingIdx = headers.findIndex(h => ['boarding', 'boarding dogs', 'boardingdogs', 'boarding_dogs', 'boardings', 'day start', 'day end'].includes(h))
    const daycareIdx = headers.findIndex(h => ['daycare', 'daycare dogs', 'daycaredogs', 'daycare_dogs', 'daycares'].includes(h))
    if (monthIdx === -1 || boardingIdx === -1 || daycareIdx === -1) {
      setError('CSV format not recognised. Expected either PawPartner daily export or columns: Month, Boarding, Daycare')
      return
    }
    const imported: Record<string, { boardingDogs: number; daycareDogs: number }> = {}
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i])
      const rawMonth = cols[monthIdx]?.trim()
      if (!rawMonth) continue
      let monthKey = rawMonth
      if (/^\d{4}-\d{2}$/.test(rawMonth)) {
        monthKey = rawMonth
      } else {
        const d = new Date(rawMonth)
        if (!isNaN(d.getTime())) {
          monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        }
      }
      imported[monthKey] = {
        boardingDogs: parseInt(cols[boardingIdx]) || 0,
        daycareDogs: parseInt(cols[daycareIdx]) || 0,
      }
    }
    setMonthlyData(prev => prev.map(entry => imported[entry.month]
      ? { ...entry, ...imported[entry.month] }
      : entry,
    ))
    csvInputRef.current && (csvInputRef.current.value = '')
    showToast('Imported monthly occupancy CSV data', 'success')
  }

  const updateMonthly = (month: string, field: 'boardingDogs' | 'daycareDogs', value: string) => {
    setMonthlyData(prev => prev.map(m => m.month === month ? { ...m, [field]: parseInt(value) || 0 } : m))
  }

  const handleSaveInputs = async () => {
    setSavingInputs(true)
    try {
      const payload = {
        totalDailyCapacity: totalDailyCapacity ? parseInt(totalDailyCapacity) : undefined,
        boardingRuns: boardingRuns ? parseInt(boardingRuns) : undefined,
        daycareSpots: daycareSpotsInput ? parseInt(daycareSpotsInput) : (computedDaycare ?? undefined),
        groomingStations: groomingStations ? parseInt(groomingStations) : undefined,
        bathingStations: bathingStations ? parseInt(bathingStations) : undefined,
        monthlyData: monthlyData.filter(m => m.boardingDogs > 0 || m.daycareDogs > 0),
        updatedAt: new Date().toISOString(),
      }
      const res = await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: 'occupancyReviewInputs',
          data: payload,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      showToast('Capacity model and monthly occupancy data saved', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to save inputs', 'error')
    } finally {
      setSavingInputs(false)
    }
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
      if (bathingStations) formData.append('bathingStations', bathingStations)
      formData.append('monthlyData', JSON.stringify(monthlyData.filter(m => m.boardingDogs > 0 || m.daycareDogs > 0)))
      formData.append('provider', provider)
      formData.append('modelId', resolveAgentModelId(provider))
      for (const uploaded of uploadedFiles) {
        formData.append('files', uploaded.file)
      }
      const res = await fetch('/api/occupancy-review', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setReport(data.report)
      setUploadedFiles([])
      setComposingNew(false)
      await saveAgentAnalysisRunClient({
        clientId,
        agentKey: AGENT_RUN_KEYS.occupancyReview,
        fileName: `${clientName} — Occupancy Review`,
        report: data.report,
        markdown: data.report?.markdown,
        documentNames: uploadedFiles.map(f => f.name),
        aiProvider: provider,
        aiModel: resolveAgentModelId(provider),
      })
      await reloadRuns({ selectNewest: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate occupancy review.')
    } finally {
      setGenerating(false)
    }
  }

  const handleDeleteReport = async () => {
    setIsDeleting(true)
    try {
      await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'occupancyReview', data: null }),
      })
      setReport(null)
      setComposingNew(false)
      setDeleteModalOpen(false)
      showToast('Occupancy review report deleted', 'success')
      await reloadRuns()
    } catch {
      showToast('Failed to delete report', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleNewAnalysis = () => {
    setComposingNew(true)
    setError(null)
  }

  const filledMonthsCount = useMemo(() => {
    return monthlyData.filter(m => m.boardingDogs > 0 || m.daycareDogs > 0).length
  }, [monthlyData])

  const canRun = Boolean(
    (totalDailyCapacity || boardingRuns || daycareSpotsInput) &&
    (filledMonthsCount > 0 || uploadedFiles.length > 0 || clientDocs.length > 0),
  )

  const html = useMemo(() => report ? buildOccupancyReviewReportHtml(report) : '', [report])

  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    )
  }

  // ────────────────────────── Report View ──────────────────────────
  if (report && !composingNew) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
                Occupancy &amp; Capacity Utilization Review
              </h1>
              {report.computed && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {report.computed.avgUtilization}% Avg Utilization
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {report.clientName || clientName} &middot; Generated {new Date(report.generatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {!readOnly && (
            <div className="flex items-center gap-2 shrink-0">
              <ExportReportButton
                html={html}
                fileName={`occupancy-review-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
                label="Export PDF"
                buttonClassName="border-slate-200 text-slate-600 hover:bg-slate-50 text-xs px-3 py-1.5 cursor-pointer"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteModalOpen(true)}
                className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-slate-200 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleNewAnalysis}
                className="h-8 text-xs cursor-pointer border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                New Analysis
              </Button>
            </div>
          )}
        </div>

        {/* Toolbar */}
        {!readOnly && (
          <AgentRunToolbar
            provider={provider}
            onProviderChange={setProvider}
            disabled={generating}
            historyItems={historyItems}
            activeId={activeId}
            onSelectRun={selectRun}
            activeProvider={activeRun?.aiProvider}
            activeModel={activeRun?.aiModel}
            activeVersion={activeRun?.version}
          />
        )}

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            {error}
          </div>
        )}

        {/* Metrics summary */}
        {report.computed && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Avg Utilization</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{report.computed.avgUtilization}%</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Across 24 Months</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Peak Months</p>
              <p className="text-xs font-semibold text-slate-800 mt-1 leading-snug">
                {report.computed.peakMonths.slice(0, 2).map(m => formatMonthLabel(m)).join(', ') || '—'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">High Capacity Strain</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Trough Months</p>
              <p className="text-xs font-semibold text-slate-800 mt-1 leading-snug">
                {report.computed.troughMonths.slice(0, 2).map(m => formatMonthLabel(m)).join(', ') || '—'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Seasonal Capacity Dip</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Daycare Displacement</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{report.computed.daycareDisplacementPct}%</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Boarding Priority Mix</p>
            </div>
          </div>
        )}

        {/* Chart */}
        {report.computed?.monthlyTotals?.length ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-1">
              24-Month Occupancy Trend &mdash; Boarding vs Daycare
            </h3>
            <p className="text-xs text-slate-500 mb-2">Historical volume distribution across boarding and daycare lines</p>
            <OccupancyChart data={report.computed.monthlyTotals} />
          </div>
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
            showToast('Occupancy review report updated', 'success')
          }}
        />

        {/* Delete Confirmation Modal */}
        <DeleteConfirmModal
          open={deleteModalOpen}
          title="Delete Occupancy Review Report?"
          description="This will permanently delete the current occupancy review report from this client record. The underlying capacity model and 24-month monthly figures will remain intact."
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDeleteReport}
          confirmLabel="Delete Report"
          isDeleting={isDeleting}
        />

        {/* Status Toast */}
        <StatusToast toast={toast} onClose={() => setToast(null)} />
      </div>
    )
  }

  // ────────────────────────── Starting Workspace View ──────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            Occupancy &amp; Capacity Utilization Review
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Buyer-facing capacity utilization, kennel occupancy analysis, and daycare displacement model for{' '}
            <span className="font-medium text-slate-700">{clientName}</span>.
          </p>
        </div>

        {!readOnly && report && composingNew && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setComposingNew(false)}
            className="h-8 text-xs cursor-pointer border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Cancel &amp; Return to Report
          </Button>
        )}
      </div>

      {/* Toolbar */}
      {!readOnly && (
        <AgentRunToolbar
          provider={provider}
          onProviderChange={setProvider}
          disabled={generating}
          historyItems={historyItems}
          activeId={activeId}
          onSelectRun={selectRun}
          activeProvider={activeRun?.aiProvider}
          activeModel={activeRun?.aiModel}
          activeVersion={activeRun?.version}
        />
      )}

      {/* Main Workspace Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
        {/* Top Informational Copy */}
        <p className="text-xs text-slate-500">
          Capacity limits and station counts prefill automatically from the Required Information form submitted by the client in the Client Portal. 24-month monthly figures automatically parse and import from the client&apos;s uploaded Occupancy Review document (<code className="font-mono text-[11px] text-slate-700 bg-slate-100 px-1 py-0.5 rounded">occupancy_review</code>). Advisors can review, fine-tune, or import additional CSV data below before running analysis.
        </p>

        {/* Sector Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Capacity Model &amp; 24-Month Occupancy Data
            </span>
            <span
              className={cn(
                'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                totalDailyCapacity || boardingRuns
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200',
              )}
            >
              {totalDailyCapacity ? `${totalDailyCapacity} Daily Max Capacity` : boardingRuns ? `${boardingRuns} Runs Configured` : 'Capacity Missing'}
            </span>
            <span
              className={cn(
                'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                filledMonthsCount >= 12
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : filledMonthsCount > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200',
              )}
            >
              {filledMonthsCount} of 24 months recorded
            </span>
            <span
              className={cn(
                'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                clientDocs.length > 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200',
              )}
            >
              {clientDocs.length} client upload{clientDocs.length !== 1 ? 's' : ''} linked
            </span>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer transition-colors shrink-0"
          >
            <RotateCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
            Refresh from Portal &amp; Profile
          </button>
        </div>

        {/* Informational Callout Banner */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-xs space-y-1">
            <div className="font-semibold text-slate-800">
              Automated 24-Month Capacity Utilization &amp; Daycare Displacement Modeling
            </div>
            <p className="text-slate-600 leading-relaxed">
              The AI agent calculates seasonal peak vs trough utilization, models daycare displacement by high-margin boarding during holidays, and analyzes revenue expansion headroom for potential buyers.
            </p>
          </div>
        </div>

        {/* Source Cards */}
        <div className="space-y-4">
          {/* Card 1: Facility Capacity Model */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 truncate">Facility Capacity Model</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      Client Portal Required Info
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    Owner-stated max capacity, physical kennel runs, daycare spots, and service stations
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveInputs}
                disabled={savingInputs}
                className="h-7 text-xs cursor-pointer shrink-0"
              >
                <Save className="w-3 h-3 mr-1" />
                {savingInputs ? 'Saving...' : 'Save Capacity'}
              </Button>
            </div>

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Total Daily Capacity <span className="text-amber-600 font-bold">(Owner-Stated Max) *</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={totalDailyCapacity}
                  onChange={e => setTotalDailyCapacity(e.target.value)}
                  placeholder="e.g. 75"
                  className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Boarding Runs / Kennels *
                </label>
                <input
                  type="number"
                  min="0"
                  value={boardingRuns}
                  onChange={e => setBoardingRuns(e.target.value)}
                  placeholder="e.g. 45"
                  className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                    Daycare Spots
                  </label>
                  {computedDaycare !== null && (
                    <span className="text-[10px] text-slate-400 font-normal">
                      (auto: {computedDaycare})
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  value={daycareSpotsInput}
                  onChange={e => setDaycareSpotsInput(e.target.value)}
                  placeholder={computedDaycare !== null ? `Auto: ${computedDaycare}` : 'e.g. 30'}
                  className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Grooming Stations
                </label>
                <input
                  type="number"
                  min="0"
                  value={groomingStations}
                  onChange={e => setGroomingStations(e.target.value)}
                  placeholder="e.g. 6"
                  className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Bathing Stations
                </label>
                <input
                  type="number"
                  min="0"
                  value={bathingStations}
                  onChange={e => setBathingStations(e.target.value)}
                  placeholder="e.g. 4"
                  className="w-full text-xs rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Card 2: 24-Month Monthly Occupancy Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 truncate">24-Month Monthly Occupancy Data</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {filledMonthsCount} / 24 Months
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    Average monthly boarding dogs and daycare dogs. Auto-imported from portal upload or editable manually.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => csvInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
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
            </div>

            {/* Compact scrollable table container */}
            <div className="rounded-lg border border-slate-200 overflow-hidden max-h-[380px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2 px-3">Month</th>
                    <th className="py-2 px-3 text-center">Boarding Dogs</th>
                    <th className="py-2 px-3 text-center">Daycare Dogs</th>
                    <th className="py-2 px-3 text-right">Combined Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyData.map(m => {
                    const total = m.boardingDogs + m.daycareDogs
                    return (
                      <tr key={m.month} className="hover:bg-slate-50/60">
                        <td className="py-1.5 px-3 font-semibold text-slate-700">
                          {formatMonthLabel(m.month)}
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={m.boardingDogs || ''}
                            onChange={e => updateMonthly(m.month, 'boardingDogs', e.target.value)}
                            placeholder="0"
                            className="w-20 rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-800 text-center outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={m.daycareDogs || ''}
                            onChange={e => updateMonthly(m.month, 'daycareDogs', e.target.value)}
                            placeholder="0"
                            className="w-20 rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-800 text-center outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-700">
                          {total > 0 ? total : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 3: Required & Supporting Occupancy Documents */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pb-2 border-b border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Required &amp; Supporting Occupancy Documents
                </span>
                <span
                  className={cn(
                    'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                    clientDocs.some(d => (d.documentId || 'occupancy_review') === 'occupancy_review')
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200',
                  )}
                >
                  {clientDocs.some(d => (d.documentId || 'occupancy_review') === 'occupancy_review')
                    ? '1 of 1 required uploaded'
                    : '0 of 1 required uploaded'}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200">
                  {clientDocs.length} document{clientDocs.length !== 1 ? 's' : ''} linked
                </span>
              </div>

              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-[11px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                <RotateCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
                Refresh
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Review documents uploaded by the client or upload files directly. The occupancy review booking export is required for automated capacity and volume modeling.
            </p>

            {/* Document Card List */}
            <div className="space-y-3 pt-1">
              {OCCUPANCY_DOCUMENT_SLOTS.map(slot => {
                const slotDocs = clientDocs.filter(d =>
                  slot.key === 'occupancy_review'
                    ? (d.documentId || 'occupancy_review') === 'occupancy_review'
                    : d.documentId === slot.documentId,
                )
                return (
                  <OccupancySlotRow
                    key={slot.key}
                    slot={slot}
                    docs={slotDocs}
                    onUpload={handleUploadSlotDoc}
                    onDelete={handleDeleteSlotDoc}
                    uploading={uploadingSlot === slot.documentId}
                    readOnly={readOnly}
                  />
                )
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 px-4 py-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Action Footer */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            {canRun ? (
              <span className="text-xs text-emerald-700 font-medium inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Capacity model and {filledMonthsCount} month(s) of occupancy data ready. Ready for buyer-facing review.
              </span>
            ) : (
              <span className="text-xs text-amber-700 font-medium inline-flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Please configure capacity model or record monthly occupancy numbers to run review.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveInputs}
              disabled={savingInputs || generating}
              className="h-9 px-4 text-xs font-medium cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              {savingInputs ? 'Saving...' : 'Save Inputs'}
            </Button>

            <Button
              type="button"
              onClick={analyze}
              disabled={generating || !canRun}
              className="h-9 px-5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-xs disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                  Analyzing Occupancy Trends...
                </>
              ) : (
                <>
                  <TrendingUp className="w-3.5 h-3.5 mr-2" />
                  Generate Buyer-Facing Occupancy Report
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        title="Delete Occupancy Review Report?"
        description="This will permanently delete the current occupancy review report from this client record. The underlying capacity model and 24-month monthly figures will remain intact."
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteReport}
        confirmLabel="Delete Report"
        isDeleting={isDeleting}
      />

      {/* Status Toast */}
      <StatusToast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
