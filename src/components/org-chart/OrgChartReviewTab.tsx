'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  Upload,
  Star,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  FileText,
  Save,
  Pencil,
  Trash2,
  Plus,
  Play,
  X,
  Users,
  Check,
} from 'lucide-react'
import { Card, Badge, cn } from '@/components/ui'
import type { OrgChartAnalysis } from '@/lib/org-chart/analyze'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { buildOrgChartReportHtml } from '@/lib/report-export/build-org-chart-report'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'
import type { DocumentStatus } from '@/lib/store'

const ACCEPTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.xlsx', '.xls', '.csv']

const RISK_COLORS: Record<string, string> = {
  high: 'red',
  medium: 'gold',
  low: 'green',
}

const READINESS_CONFIG: Record<string, { color: string; label: string }> = {
  high: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'High Readiness' },
  medium: { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Medium Readiness' },
  low: { color: 'bg-red-100 text-red-700 border-red-200', label: 'Low Readiness' },
}

const TRANSITION_RISK_OPTIONS = ['high', 'medium', 'low']

const ORG_CHART_DOCUMENT_ID = 'org_chart'

type UploadedOrgChartDoc = {
  id: string
  fileName: string
  mimeType?: string | null
  uploadedAt?: string
  size?: number | null
}

type ActiveOrgChartFile = {
  file?: File
  docId?: string
  name: string
  sizeFormatted?: string
  mimeType?: string | null
  isPortal?: boolean
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Editable Cell helper ────────────────────────────────────────────────────
function EditableCell({
  value,
  onChange,
  editMode,
  className,
}: {
  value: string
  onChange: (val: string) => void
  editMode: boolean
  className?: string
}) {
  if (!editMode) {
    return <span className={cn('text-slate-700', className)}>{value}</span>
  }
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn(
        'w-full bg-white border border-amber-300 text-xs text-slate-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400',
        className
      )}
    />
  )
}

export default function OrgChartReviewTab({
  clientId,
  clientName,
  documentStatuses,
  onRefreshDocuments,
  readOnly = false,
}: {
  clientId: string
  clientName: string
  documentStatuses?: Record<string, DocumentStatus>
  onRefreshDocuments?: () => Promise<void> | void
  readOnly?: boolean
}) {
  const [activeFile, setActiveFile] = useState<ActiveOrgChartFile | null>(null)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedOrgChartDoc[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isComposingNew, setIsComposingNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<OrgChartAnalysis | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedBadge, setSavedBadge] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { provider, setProvider } = useAgentAiProvider()
  const {
    runs,
    historyItems,
    activeRun,
    activeId,
    setActiveId,
    reload: reloadRuns,
    loading: loadingRuns,
  } = useGenericAgentRuns(clientId, AGENT_RUN_KEYS.orgChartReview)

  const canAnalyze = Boolean(activeFile)

  const loadUploadedOrgCharts = useCallback(async () => {
    setIsRefreshing(true)
    try {
      if (onRefreshDocuments) {
        await onRefreshDocuments()
      }
      const res = await fetch(
        `/api/client-documents?clientId=${encodeURIComponent(clientId)}&documentId=${ORG_CHART_DOCUMENT_ID}&all=true`,
        { cache: 'no-store' },
      )
      if (!res.ok) return
      const data = await res.json()
      const docs = Array.isArray(data?.documents) ? (data.documents as UploadedOrgChartDoc[]) : []
      setUploadedDocs(docs)

      // If no active file is staged yet, auto-select the first uploaded document
      setActiveFile(current => {
        if (current) {
          if (current.docId && !docs.some(d => d.id === current.docId)) {
            return null
          }
          return current
        }
        if (docs.length > 0) {
          return {
            docId: docs[0].id,
            name: docs[0].fileName,
            sizeFormatted: formatFileSize(docs[0].size),
            mimeType: docs[0].mimeType,
            isPortal: true,
          }
        }
        return null
      })
    } catch {
      /* ignore */
    } finally {
      setIsRefreshing(false)
    }
  }, [clientId, onRefreshDocuments])

  useEffect(() => {
    void loadUploadedOrgCharts()
  }, [loadUploadedOrgCharts])

  // Load saved data on mount
  useEffect(() => {
    if (loadingRuns) return
    if (activeRun?.report) {
      const payload = activeRun.report as OrgChartAnalysis
      if (payload?.summary) {
        setResult(payload)
        setIsComposingNew(false)
      }
      setHydrated(true)
      return
    }
    const loadSaved = async () => {
      try {
        const res = await fetch(`/api/client-data/${clientId}?section=orgChart`)
        if (res.ok) {
          const data = await res.json()
          if (data && data.summary) {
            setResult(data)
            setIsComposingNew(false)
          }
        }
      } catch {
        /* ignore */
      } finally {
        setHydrated(true)
      }
    }
    loadSaved()
  }, [clientId, activeRun, loadingRuns])

  function selectRun(run: AgentRunHistoryItem) {
    setActiveId(run.id)
    const full = runs.find((item) => item.id === run.id)
    if (full?.report) {
      setResult(full.report as OrgChartAnalysis)
      setIsComposingNew(false)
      setEditMode(false)
    }
  }

  const uploadAndStageFile = async (newFile: File) => {
    setIsUploading(true)
    setError(null)
    try {
      // 1. Upload to client documents so it persists into the Documents tab automatically
      if (clientId) {
        const fd = new FormData()
        fd.append('file', newFile)
        fd.append('clientId', clientId)
        fd.append('documentId', ORG_CHART_DOCUMENT_ID)
        fd.append('uploadedBy', 'advisor')
        try {
          await fetch('/api/client-documents/upload', {
            method: 'POST',
            body: fd,
          })
          void loadUploadedOrgCharts()
        } catch (uploadErr) {
          console.warn('Background save to client documents failed:', uploadErr)
        }
      }

      // 2. Set active file
      setActiveFile({
        file: newFile,
        name: newFile.name,
        sizeFormatted: formatFileSize(newFile.size),
        isPortal: false,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to process org chart file')
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      void uploadAndStageFile(files[0])
    }
    e.target.value = ''
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void uploadAndStageFile(e.dataTransfer.files[0])
    }
  }

  const handleSelectPortalDoc = (doc: UploadedOrgChartDoc) => {
    setActiveFile({
      docId: doc.id,
      name: doc.fileName,
      sizeFormatted: formatFileSize(doc.size),
      mimeType: doc.mimeType,
      isPortal: true,
    })
    setError(null)
  }

  const handleClearActiveFile = () => {
    setActiveFile(null)
    setError(null)
  }

  const resolveAnalysisFile = async (): Promise<File> => {
    if (activeFile?.file) return activeFile.file
    if (activeFile?.docId) {
      const params = new URLSearchParams({
        clientId,
        documentId: ORG_CHART_DOCUMENT_ID,
        recordId: activeFile.docId,
      })
      const raw = await fetch(`/api/client-documents/raw?${params.toString()}`)
      if (!raw.ok) throw new Error((await raw.text()) || 'Failed to load uploaded org chart.')
      const blob = await raw.blob()
      return new File(
        [blob],
        activeFile.name || 'org-chart',
        { type: activeFile.mimeType || blob.type || 'application/octet-stream' },
      )
    }
    throw new Error('Upload or select an org chart first.')
  }

  const handleAnalyze = async () => {
    if (!canAnalyze) return
    setAnalyzing(true)
    setError(null)
    try {
      const analysisFile = await resolveAnalysisFile()
      const formData = new FormData()
      formData.append('file', analysisFile)
      formData.append('provider', provider)
      formData.append('modelId', resolveAgentModelId(provider))
      const res = await fetch('/api/org-chart/analyze', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Analysis failed (${res.status})`)
      }
      const data: OrgChartAnalysis = await res.json()
      setResult(data)
      setIsComposingNew(false)
      try {
        const saveRes = await fetch(`/api/client-data/${clientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'orgChart', data }),
        })
        if (!saveRes.ok) throw new Error('Save failed')
        await saveAgentAnalysisRunClient({
          clientId,
          agentKey: AGENT_RUN_KEYS.orgChartReview,
          fileName: analysisFile.name,
          report: data,
          documentNames: [analysisFile.name],
          aiProvider: provider,
          aiModel: resolveAgentModelId(provider),
        })
        await reloadRuns({ selectNewest: true })
        setSavedBadge(true)
        setTimeout(() => setSavedBadge(false), 2000)
      } catch (saveErr: any) {
        setError(saveErr.message || 'Analysis completed but failed to save')
      }
    } catch (err: any) {
      setError(err.message || 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Save handler ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!result) return
    setSaving(true)
    try {
      const res = await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'orgChart', data: result }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSavedBadge(true)
      setTimeout(() => setSavedBadge(false), 2000)
    } catch (err: any) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete report handler ──────────────────────────────────────────────────
  const handleDeleteReport = async () => {
    if (!confirm('Are you sure you want to delete this org chart analysis?')) return
    try {
      await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'orgChart', data: null }),
      })
      setResult(null)
      setIsComposingNew(true)
      setEditMode(false)
    } catch (err: any) {
      setError(err.message || 'Failed to delete report')
    }
  }

  // ── Mutation helpers ──────────────────────────────────────────────────────
  const updateRole = (index: number, field: string, value: any) => {
    if (!result) return
    const roles = [...result.roles]
    roles[index] = { ...roles[index], [field]: value }
    setResult({ ...result, roles })
  }

  const addRole = () => {
    if (!result) return
    setResult({
      ...result,
      roles: [...result.roles, { name: '', title: '', department: '', reportsTo: '', keyPerson: false, transitionRisk: 'low', notes: '' }],
    })
  }

  const removeRole = (index: number) => {
    if (!result) return
    const roles = [...result.roles]
    roles.splice(index, 1)
    setResult({ ...result, roles })
  }

  const updateDep = (index: number, field: string, value: string) => {
    if (!result) return
    const deps = [...result.keyPersonDependencies]
    deps[index] = { ...deps[index], [field]: value }
    setResult({ ...result, keyPersonDependencies: deps })
  }

  const addDep = () => {
    if (!result) return
    setResult({
      ...result,
      keyPersonDependencies: [...result.keyPersonDependencies, { person: '', title: '', risk: '', mitigation: '' }],
    })
  }

  const removeDep = (index: number) => {
    if (!result) return
    const deps = [...result.keyPersonDependencies]
    deps.splice(index, 1)
    setResult({ ...result, keyPersonDependencies: deps })
  }

  const updateListItem = (listKey: 'roleGaps' | 'recommendations', index: number, value: string) => {
    if (!result) return
    const list = [...result[listKey]]
    list[index] = value
    setResult({ ...result, [listKey]: list })
  }

  const addListItem = (listKey: 'roleGaps' | 'recommendations') => {
    if (!result) return
    setResult({ ...result, [listKey]: [...result[listKey], ''] })
  }

  const removeListItem = (listKey: 'roleGaps' | 'recommendations', index: number) => {
    if (!result) return
    const list = [...result[listKey]]
    list.splice(index, 1)
    setResult({ ...result, [listKey]: list })
  }

  // ── Read-only gate ────────────────────────────────────────────────────────
  const readOnlyGate = agentTabReadOnlyGate(readOnly, !hydrated, Boolean(result), 'Org Chart Review')
  if (readOnlyGate) return readOnlyGate

  const showReport = Boolean(result && !isComposingNew)

  // ── Report View ───────────────────────────────────────────────────────────
  if (showReport && result) {
    const readiness = READINESS_CONFIG[result.transitionReadiness] || READINESS_CONFIG.medium
    return (
      <div className="space-y-6">
        {!readOnly && (
          <AgentRunToolbar
            provider={provider}
            onProviderChange={setProvider}
            disabled={analyzing}
            historyItems={historyItems}
            activeId={activeId}
            onSelectRun={selectRun}
            activeProvider={activeRun?.aiProvider}
            activeModel={activeRun?.aiModel}
            activeVersion={activeRun?.version}
          />
        )}

        {/* Serif Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
              Organizational Chart Review Report
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {clientName} &mdash; Generated {new Date(result.generatedAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap" data-advisor-action>
            {!readOnly && (
              <button
                onClick={() => setIsComposingNew(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Analysis</span>
              </button>
            )}
            <button
              onClick={() => setEditMode(e => !e)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border',
                editMode
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
              )}
            >
              <Pencil className="w-3.5 h-3.5" />
              {editMode ? 'Editing' : 'Edit'}
            </button>
            {editMode && (
              <div className="relative">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save'}
                </button>
                {savedBadge && (
                  <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                    Saved
                  </span>
                )}
              </div>
            )}
            <ExportReportButton
              html={buildOrgChartReportHtml(result, clientName)}
              fileName={`org-chart-report-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
              label="Export Org Chart Report"
            />
            {!readOnly && (
              <button
                onClick={handleDeleteReport}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Report"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-200">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Transition Readiness Badge */}
        <div className={cn('inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold', readiness.color)}>
          {result.transitionReadiness === 'high' && <CheckCircle className="w-4 h-4" />}
          {result.transitionReadiness === 'medium' && <AlertTriangle className="w-4 h-4" />}
          {result.transitionReadiness === 'low' && <AlertTriangle className="w-4 h-4" />}
          Transition Readiness: {readiness.label}
        </div>

        {/* Summary */}
        <Card className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Summary</h3>
          {editMode ? (
            <textarea
              value={result.summary}
              onChange={e => setResult({ ...result, summary: e.target.value })}
              rows={4}
              className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y"
            />
          ) : (
            <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
          )}
        </Card>

        {/* Headcount */}
        <Card className="p-5 text-center max-w-[200px]">
          {editMode ? (
            <div className="space-y-1">
              <input
                type="number"
                value={result.totalHeadcount ?? ''}
                onChange={e => setResult({ ...result, totalHeadcount: e.target.value ? Number(e.target.value) : null })}
                className="w-full text-center border border-amber-300 rounded-lg px-3 py-2 text-2xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <p className="text-xs text-slate-400 mt-1">Total Headcount</p>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold text-slate-800">{result.totalHeadcount ?? 'N/A'}</p>
              <p className="text-xs text-slate-400 mt-1">Total Headcount</p>
            </>
          )}
        </Card>

        {/* Roles Table */}
        <Card className="overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Roles ({result.roles.length})</h3>
            {editMode && (
              <button
                onClick={addRole}
                className="text-xs text-amber-600 hover:text-amber-800 font-medium"
              >
                + Add Role
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Name</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Title</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Department</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Reports To</th>
                  <th className="text-center px-4 py-2.5 font-semibold text-slate-500">Key Person</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-slate-500">Transition Risk</th>
                  {editMode && <th className="text-center px-4 py-2.5 font-semibold text-slate-500 w-[50px]" />}
                </tr>
              </thead>
              <tbody>
                {result.roles.map((role, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5 font-medium">
                      <EditableCell value={role.name} onChange={v => updateRole(i, 'name', v)} editMode={editMode} />
                    </td>
                    <td className="px-4 py-2.5">
                      <EditableCell value={role.title} onChange={v => updateRole(i, 'title', v)} editMode={editMode} />
                    </td>
                    <td className="px-4 py-2.5">
                      <EditableCell value={role.department} onChange={v => updateRole(i, 'department', v)} editMode={editMode} />
                    </td>
                    <td className="px-4 py-2.5">
                      <EditableCell value={role.reportsTo} onChange={v => updateRole(i, 'reportsTo', v)} editMode={editMode} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {editMode ? (
                        <input
                          type="checkbox"
                          checked={role.keyPerson}
                          onChange={e => updateRole(i, 'keyPerson', e.target.checked)}
                          className="accent-amber-500"
                        />
                      ) : (
                        role.keyPerson && <Star className="w-3.5 h-3.5 text-amber-500 mx-auto fill-amber-500" />
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {editMode ? (
                        <select
                          value={role.transitionRisk}
                          onChange={e => updateRole(i, 'transitionRisk', e.target.value)}
                          className="w-full bg-white border border-amber-300 text-xs text-slate-700 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        >
                          {TRANSITION_RISK_OPTIONS.map(o => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <Badge color={RISK_COLORS[role.transitionRisk] as 'red' | 'gold' | 'green'}>
                          {role.transitionRisk}
                        </Badge>
                      )}
                    </td>
                    {editMode && (
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => removeRole(i)} className="text-red-400 hover:text-red-600 text-xs">
                          &times;
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Key Person Dependencies */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Key Person Dependencies</h3>
            {editMode && (
              <button onClick={addDep} className="text-xs text-amber-600 hover:text-amber-800 font-medium">
                + Add Dependency
              </button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {result.keyPersonDependencies.map((dep, i) => (
              <Card key={i} className="p-4">
                <div className="flex items-start gap-3">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {editMode ? (
                      <div className="space-y-2">
                        <input
                          value={dep.person}
                          onChange={e => updateDep(i, 'person', e.target.value)}
                          placeholder="Person"
                          className="w-full border border-amber-300 rounded px-2 py-1 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <input
                          value={dep.title}
                          onChange={e => updateDep(i, 'title', e.target.value)}
                          placeholder="Title"
                          className="w-full border border-amber-300 rounded px-2 py-1 text-xs text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <input
                          value={dep.risk}
                          onChange={e => updateDep(i, 'risk', e.target.value)}
                          placeholder="Risk"
                          className="w-full border border-amber-300 rounded px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <input
                          value={dep.mitigation}
                          onChange={e => updateDep(i, 'mitigation', e.target.value)}
                          placeholder="Mitigation"
                          className="w-full border border-amber-300 rounded px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                        <button onClick={() => removeDep(i)} className="text-xs text-red-400 hover:text-red-600">
                          Remove
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-slate-800">{dep.person}</p>
                        <p className="text-xs text-slate-500 mb-2">{dep.title}</p>
                        <div className="space-y-1.5">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wide text-red-400">Risk: </span>
                            <span className="text-xs text-slate-600">{dep.risk}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">Mitigation: </span>
                            <span className="text-xs text-slate-600">{dep.mitigation}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Role Gaps */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Role Gaps</h3>
            {editMode && (
              <button onClick={addRoleGaps => addListItem('roleGaps')} className="text-xs text-amber-600 hover:text-amber-800 font-medium">
                + Add Gap
              </button>
            )}
          </div>
          <ul className="space-y-1.5">
            {result.roleGaps.map((gap, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="text-amber-500 mt-1 flex-shrink-0">&bull;</span>
                {editMode ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={gap}
                      onChange={e => updateListItem('roleGaps', i, e.target.value)}
                      className="flex-1 border border-amber-300 rounded px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button onClick={() => removeListItem('roleGaps', i)} className="text-red-400 hover:text-red-600 text-xs">
                      &times;
                    </button>
                  </div>
                ) : (
                  gap
                )}
              </li>
            ))}
          </ul>
        </Card>

        {/* Recommendations */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Recommendations</h3>
            {editMode && (
              <button onClick={() => addListItem('recommendations')} className="text-xs text-amber-600 hover:text-amber-800 font-medium">
                + Add Recommendation
              </button>
            )}
          </div>
          <ol className="space-y-2">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {editMode ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      value={rec}
                      onChange={e => updateListItem('recommendations', i, e.target.value)}
                      className="flex-1 border border-amber-300 rounded px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                    <button onClick={() => removeListItem('recommendations', i)} className="text-red-400 hover:text-red-600 text-xs">
                      &times;
                    </button>
                  </div>
                ) : (
                  rec
                )}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    )
  }

  // ── Uploader / Staging View ───────────────────────────────────────────────
  const activeFileReady = Boolean(activeFile)

  return (
    <div className="space-y-6">
      {!readOnly && (
        <AgentRunToolbar
          provider={provider}
          onProviderChange={setProvider}
          disabled={analyzing}
          historyItems={historyItems}
          activeId={activeId}
          onSelectRun={selectRun}
          activeProvider={activeRun?.aiProvider}
          activeModel={activeRun?.aiModel}
          activeVersion={activeRun?.version}
        />
      )}

      {/* Serif Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            {result ? 'New Org Chart Analysis' : 'Org Chart Review'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Analyze organizational hierarchy, key-person dependencies, and transition readiness for {clientName}
          </p>
        </div>
        {result && (
          <button
            type="button"
            onClick={() => setIsComposingNew(false)}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors self-start sm:self-auto"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Sector: REQUIRED ORG CHART DOCUMENTS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Required Org Chart Documents
            </h3>
            <span
              className={cn(
                'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                activeFileReady
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              )}
            >
              {activeFileReady ? '1 document ready' : '0 of 1 ready'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void loadUploadedOrgCharts()}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
            <span>Refresh</span>
          </button>
        </div>
        <p className="text-xs text-slate-400 -mt-1">
          Current organizational hierarchy, leadership reporting lines, or headcount documentation.
        </p>

        {/* Card Row */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'rounded-xl border transition-all p-4 space-y-3',
            isDragging
              ? 'border-amber-400 bg-amber-50/40 ring-2 ring-amber-400/20'
              : activeFileReady
                ? 'border-slate-200 bg-white hover:border-slate-300'
                : 'border-dashed border-slate-300 bg-slate-50/50 hover:border-slate-400'
          )}
        >
          {/* Card Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                  activeFileReady
                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                )}
              >
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold text-slate-800">
                    Organizational Chart
                  </h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    Required
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                      activeFileReady
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    )}
                  >
                    {activeFileReady ? 'Uploaded (1 ready)' : 'Missing'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Supported formats: PDF, PNG, JPG, XLSX, XLS, or CSV.
                </p>
              </div>
            </div>

            {/* Action button */}
            <div className="flex-shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
              >
                {isUploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-400/30 border-t-slate-600 rounded-full animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 text-slate-500" />
                    <span>{activeFileReady ? 'Replace Chart' : '+ Upload Org Chart'}</span>
                  </>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS.join(',')}
                className="hidden"
                onChange={handleFileInputChange}
              />
            </div>
          </div>

          {/* Active Selected/Uploaded File Chip */}
          {activeFile && (
            <div className="pt-1">
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/40 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-medium text-slate-800 truncate">
                    {activeFile.name}
                  </span>
                  {activeFile.sizeFormatted && (
                    <span className="text-[10px] text-slate-500 flex-shrink-0">
                      ({activeFile.sizeFormatted})
                    </span>
                  )}
                  {activeFile.isPortal && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 flex-shrink-0">
                      Portal
                    </span>
                  )}
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex-shrink-0">
                    Active for Analysis
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearActiveFile}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-white/60 transition-colors"
                  title="Deselect this file"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Available Documents Section (Portal / Client Documents) */}
          {uploadedDocs.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Available in Documents ({uploadedDocs.length})
              </p>
              <div className="grid gap-2">
                {uploadedDocs.map(doc => {
                  const isSelected = activeFile?.docId === doc.id
                  return (
                    <div
                      key={doc.id}
                      className={cn(
                        'flex items-center justify-between gap-3 p-2.5 rounded-lg border text-xs transition-colors',
                        isSelected
                          ? 'border-emerald-200 bg-emerald-50/30'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText
                          className={cn('w-4 h-4 flex-shrink-0', isSelected ? 'text-emerald-600' : 'text-slate-400')}
                        />
                        <div className="min-w-0">
                          <p className="font-medium text-slate-700 truncate">{doc.fileName}</p>
                          {doc.uploadedAt && (
                            <p className="text-[10px] text-slate-400">
                              Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
                            <Check className="w-3 h-3" /> Selected
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectPortalDoc(doc)}
                            className="text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded px-2.5 py-1 transition-colors"
                          >
                            Select
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg border border-red-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Bottom Readiness Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
        <div className="flex items-center gap-2 text-xs">
          {activeFileReady ? (
            <>
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="font-medium text-slate-700">
                Org chart ready ({activeFile?.name}). You can run organizational review.
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-slate-500">
                Upload or select an organizational chart to run analysis.
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end">
          {activeFileReady && (
            <button
              type="button"
              onClick={handleClearActiveFile}
              disabled={analyzing}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              Clear
            </button>
          )}
          {result && (
            <button
              type="button"
              onClick={() => setIsComposingNew(false)}
              disabled={analyzing}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!activeFileReady || analyzing}
            className={cn(
              'inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all shadow-sm',
              activeFileReady && !analyzing
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            )}
          >
            {analyzing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Analyzing Org Chart...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Org Chart Analysis</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
