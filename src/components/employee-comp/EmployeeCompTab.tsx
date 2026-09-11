'use client'

import { Fragment, useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload, FileText, Plus, Trash2, Download, Save, Users2,
  DollarSign, Clock, Building2, AlertTriangle, CheckCircle,
  CheckCircle2, AlertCircle, FileSpreadsheet, Type, PenLine,
  Loader2, Play, RefreshCw,
} from 'lucide-react'
import { Card, Badge, Button, cn } from '@/components/ui'
import type { EmployeeCompRow, EmployeeCompReport } from '@/lib/employee-comp/analyze'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { buildEmployeeCompReportHtml } from '@/lib/report-export/build-employee-comp-report'
import { AdvisorActions } from '@/components/client-portal/AgentClientPortalFrame'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import { useAgentAiProvider } from '@/hooks/useAgentAiProvider'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import { AgentProviderBar } from '@/components/admin/AgentProviderBar'
import { AgentReportHistoryBar } from '@/components/admin/AgentReportHistoryBar'
import { resolveAgentModelId } from '@/lib/agent-model-provider'
import { useGenericAgentRuns } from '@/hooks/useGenericAgentRuns'
import { AGENT_RUN_KEYS } from '@/lib/agent-run-keys'
import { saveAgentAnalysisRunClient } from '@/lib/agent-analysis-runs.client'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'
import {
  fetchClientDocumentFile,
  isSupportedEmployeeCompFile,
  listClientDocuments,
  type ClientUploadedDoc,
} from '@/lib/client-documents-client'
import type { DocumentStatus } from '@/lib/store'

const EMPLOYEE_LIST_DOCUMENT_ID = 'employee_list'

// ── Constants ───────────────────────────────────────────────────────────────

const ACCEPTED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/csv': ['.csv'],
}

type InputMode = 'upload' | 'paste' | 'manual'

const INPUT_MODES: { key: InputMode; label: string; icon: typeof Upload }[] = [
  { key: 'upload', label: 'Upload Document', icon: FileSpreadsheet },
  { key: 'paste', label: 'Paste Text', icon: Type },
  { key: 'manual', label: 'Manual Entry', icon: PenLine },
]

const EMPLOYEE_TYPES = ['Regular Full Time', 'Regular Part Time']
const PAY_TYPES: ('Hourly' | 'Salary')[] = ['Hourly', 'Salary']

function makeEmptyRow(): EmployeeCompRow {
  return {
    id: `emp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    employeeName: '',
    hireDate: '',
    rehireDate: '',
    employeeType: 'Regular Full Time',
    workLocation: '',
    jobTitle: '',
    payType: 'Salary',
    annualSalary: null,
    hourlyRate: null,
    payRateEffectiveDate: '',
    benefitClassCode: '',
    benefitClassDescription: '',
  }
}

function recalcSummary(employees: EmployeeCompRow[]): EmployeeCompReport['summary'] {
  const fullTime = employees.filter(e => e.employeeType.toLowerCase().includes('full'))
  const partTime = employees.filter(e => e.employeeType.toLowerCase().includes('part'))
  const hourlyEmp = employees.filter(e => e.payType === 'Hourly' && e.hourlyRate !== null)
  const salaryEmp = employees.filter(e => e.payType === 'Salary' && e.annualSalary !== null)

  const totalAnnualPayroll = employees.reduce((sum, e) => {
    if (e.annualSalary) return sum + e.annualSalary
    if (e.hourlyRate) return sum + e.hourlyRate * 2080
    return sum
  }, 0)

  const avgHourlyRate = hourlyEmp.length > 0
    ? hourlyEmp.reduce((s, e) => s + (e.hourlyRate ?? 0), 0) / hourlyEmp.length
    : null

  const avgSalary = salaryEmp.length > 0
    ? salaryEmp.reduce((s, e) => s + (e.annualSalary ?? 0), 0) / salaryEmp.length
    : null

  const locationBreakdown: Record<string, number> = {}
  const roleBreakdown: Record<string, number> = {}
  for (const e of employees) {
    const loc = e.workLocation || 'Unknown'
    locationBreakdown[loc] = (locationBreakdown[loc] || 0) + 1
    const role = e.jobTitle || 'Unknown'
    roleBreakdown[role] = (roleBreakdown[role] || 0) + 1
  }

  return {
    totalHeadcount: employees.length,
    fullTimeCount: fullTime.length,
    partTimeCount: partTime.length,
    totalAnnualPayroll: Math.round(totalAnnualPayroll * 100) / 100,
    avgHourlyRate: avgHourlyRate !== null ? Math.round(avgHourlyRate * 100) / 100 : null,
    avgSalary: avgSalary !== null ? Math.round(avgSalary * 100) / 100 : null,
    locationBreakdown,
    roleBreakdown,
  }
}

function formatCurrency(val: number | null): string {
  if (val === null || val === undefined) return ''
  return val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

// ── Editable Cell ───────────────────────────────────────────────────────────

function EditableCell({
  value,
  onChange,
  type = 'text',
  options,
  className,
}: {
  value: string | number | null
  onChange: (val: string) => void
  type?: 'text' | 'number' | 'select' | 'date'
  options?: string[]
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value ?? ''))
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  useEffect(() => {
    setDraft(String(value ?? ''))
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  const commit = () => {
    setEditing(false)
    onChange(draft)
  }

  if (type === 'select' && options) {
    return (
      <select
        value={String(value ?? '')}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-amber-50/40 text-xs text-slate-700 border border-dashed border-amber-200 hover:border-amber-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 rounded px-2 py-1.5 cursor-pointer transition-colors"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  if (!editing) {
    return (
      <div
        onClick={() => setEditing(true)}
        className={cn(
          'group/cell min-h-[30px] px-2 py-1.5 rounded cursor-pointer bg-amber-50/40 border border-dashed border-amber-200 hover:border-amber-400 hover:bg-amber-50 transition-colors flex items-center gap-2 text-xs text-slate-700',
          !value && 'text-slate-300 italic',
          className
        )}
        title="Click to edit"
      >
        <span className="min-w-0 flex-1 truncate">
          {type === 'number' && value !== null && value !== '' ? formatCurrency(Number(value)) : (value ?? '')}
          {!value && '\u2014'}
        </span>
        <PenLine className="w-3 h-3 shrink-0 text-amber-500 opacity-60 group-hover/cell:opacity-100" />
      </div>
    )
  }

  return (
    <input
      ref={inputRef as any}
      type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
      step={type === 'number' ? '0.01' : undefined}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(String(value ?? '')); setEditing(false) } }}
      className="w-full bg-white border border-amber-300 text-xs text-slate-700 rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
    />
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function EmployeeCompTab({
  clientId,
  clientName,
  documentStatuses,
  readOnly = false,
}: {
  clientId: string
  clientName: string
  documentStatuses?: Record<string, DocumentStatus>
  readOnly?: boolean
}) {
  const [mode, setMode] = useState<InputMode>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [freeText, setFreeText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [employees, setEmployees] = useState<EmployeeCompRow[]>([])
  const [hasData, setHasData] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState<ClientUploadedDoc[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [composingNew, setComposingNew] = useState(false)
  const { provider, setProvider } = useAgentAiProvider()
  const {
    runs,
    historyItems,
    activeRun,
    activeId,
    setActiveId,
    reload: reloadRuns,
    loading: loadingRuns,
  } = useGenericAgentRuns(clientId, AGENT_RUN_KEYS.employeeComp)

  const selectedUploadedDoc = uploadedDocs.find(doc => doc.id === selectedDocId) ?? uploadedDocs[0] ?? null
  const canAnalyzeUpload = Boolean(file || (selectedUploadedDoc && isSupportedEmployeeCompFile(selectedUploadedDoc.fileName)))
  const portalStatus = documentStatuses?.[EMPLOYEE_LIST_DOCUMENT_ID]
  const isUnavailable = !canAnalyzeUpload && (portalStatus?.hasDoc === false || Boolean(portalStatus?.notApplicable))

  const loadUploadedEmployeeDocs = useCallback(async () => {
    setLoadingDocs(true)
    try {
      const docs = await listClientDocuments(clientId, [EMPLOYEE_LIST_DOCUMENT_ID])
      setUploadedDocs(docs)
      setSelectedDocId(current => {
        if (current && docs.some(doc => doc.id === current)) return current
        const preferred = docs.find(doc => isSupportedEmployeeCompFile(doc.fileName)) ?? docs[0]
        return preferred?.id ?? null
      })
    } catch {
      /* ignore */
    } finally {
      setLoadingDocs(false)
    }
  }, [clientId])

  useEffect(() => {
    void loadUploadedEmployeeDocs()
  }, [loadUploadedEmployeeDocs])

  // Load saved data on mount
  useEffect(() => {
    if (loadingRuns) return
    if (activeRun?.report) {
      const payload = activeRun.report as EmployeeCompReport
      if (payload?.employees?.length) {
        setEmployees(payload.employees)
        setHasData(true)
      }
      setHydrated(true)
      return
    }
    const loadSaved = async () => {
      try {
        const res = await fetch(`/api/client-data/${clientId}?section=employeeCompReport`)
        if (res.ok) {
          const data = await res.json()
          if (data && data.employees && data.employees.length > 0) {
            setEmployees(data.employees)
            setHasData(true)
          }
        }
      } catch { /* ignore */ } finally { setHydrated(true) }
    }
    loadSaved()
  }, [clientId, activeRun, loadingRuns])

  function selectRun(run: AgentRunHistoryItem) {
    setActiveId(run.id)
    setComposingNew(false)
    const full = runs.find((item) => item.id === run.id)
    const payload = (full?.report ?? null) as EmployeeCompReport | null
    if (payload?.employees?.length) {
      setEmployees(payload.employees)
      setHasData(true)
    }
  }

  const summary = recalcSummary(employees)

  const readOnlyGate = agentTabReadOnlyGate(readOnly, !hydrated, hasData, 'Employee Staffing & Compensation')
  if (readOnlyGate) return readOnlyGate

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      setFile(accepted[0])
      setSelectedDocId(null)
      setError(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive, open: openFileDialog } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    multiple: false,
    noClick: true,
  })

  const resolveAnalysisFile = async (): Promise<File> => {
    if (file) return file
    if (!selectedUploadedDoc) throw new Error('Please upload or select an employee list first')
    if (!isSupportedEmployeeCompFile(selectedUploadedDoc.fileName)) {
      throw new Error('This file type is not supported for analysis. Use PDF, Excel, CSV, or an image — .numbers files are not supported.')
    }
    return fetchClientDocumentFile({
      clientId,
      documentId: selectedUploadedDoc.documentId,
      recordId: selectedUploadedDoc.id,
      fileName: selectedUploadedDoc.fileName,
      mimeType: selectedUploadedDoc.mimeType,
    })
  }

  // ── Analyze ─────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    setAnalyzing(true)
    setError(null)
    try {
      let res: Response
      let analysisFileName = 'Employee Compensation'
      if (mode === 'upload') {
        const analysisFile = await resolveAnalysisFile()
        analysisFileName = analysisFile.name
        const formData = new FormData()
        formData.append('file', analysisFile)
        formData.append('provider', provider)
        formData.append('modelId', resolveAgentModelId(provider))
        res = await fetch('/api/employee-comp/analyze', { method: 'POST', body: formData })
      } else {
        if (!freeText.trim()) throw new Error('Please paste some payroll data first')
        res = await fetch('/api/employee-comp/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            freeText,
            provider,
            modelId: resolveAgentModelId(provider),
          }),
        })
      }

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Analysis failed (${res.status})`)
      }
      const data: EmployeeCompReport = await res.json()
      setEmployees(data.employees)
      setHasData(true)
      setComposingNew(false)
      try {
        const saveRes = await fetch(`/api/client-data/${clientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'employeeCompReport', data }),
        })
        if (!saveRes.ok) throw new Error('Save failed')
        await saveAgentAnalysisRunClient({
          clientId,
          agentKey: AGENT_RUN_KEYS.employeeComp,
          fileName: `${clientName} — ${analysisFileName}`,
          report: data,
          documentNames: [analysisFileName],
          aiProvider: provider,
          aiModel: resolveAgentModelId(provider),
        })
        await reloadRuns({ selectNewest: true })
        setSaved(true)
      } catch (saveErr: any) {
        setError(saveErr.message || 'Analysis completed but failed to save')
      }
    } catch (err: any) {
      setError(err.message || 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Row editing ─────────────────────────────────────────────────────────
  const updateRow = (id: string, field: keyof EmployeeCompRow, value: string) => {
    setEmployees(prev => prev.map(e => {
      if (e.id !== id) return e
      const updated = { ...e }
      if (field === 'annualSalary' || field === 'hourlyRate') {
        const num = value === '' ? null : Number(value)
        ;(updated as any)[field] = num
        // Auto-calculate the counterpart
        if (field === 'annualSalary' && num !== null) {
          updated.hourlyRate = Math.round((num / 2080) * 100) / 100
        }
        if (field === 'hourlyRate' && num !== null) {
          updated.annualSalary = Math.round(num * 2080 * 100) / 100
        }
      } else {
        ;(updated as any)[field] = value
      }
      return updated
    }))
    setSaved(false)
  }

  const addRow = () => {
    setEmployees(prev => [...prev, makeEmptyRow()])
    setHasData(true)
    setSaved(false)
  }

  const deleteRow = (id: string) => {
    setEmployees(prev => prev.filter(e => e.id !== id))
    setSaved(false)
  }

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      const report: EmployeeCompReport = {
        employees,
        summary: recalcSummary(employees),
        generatedAt: new Date().toISOString(),
      }
      const res = await fetch(`/api/client-data/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'employeeCompReport', data: report }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
    } catch (err: any) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Export CSV ──────────────────────────────────────────────────────────
  const exportCsv = () => {
    const headers = [
      'Employee Name', 'Hire Date', 'Rehire Date', 'Employee Type', 'Full Time Employees', 'Part Time Employees', 'Work Location',
      'Job Title', 'Hourly/Salary', 'Annual Salary', 'Hourly Rate',
      'Pay Rate Effective Date', 'Benefit Class Code', 'Benefit Class Description',
    ]
    const rows = employees.map(e => [
      e.employeeName, e.hireDate, e.rehireDate, e.employeeType,
      e.employeeType.toLowerCase().includes('full') ? 1 : '',
      e.employeeType.toLowerCase().includes('part') ? 1 : '',
      e.workLocation,
      e.jobTitle, e.payType, e.annualSalary ?? '', e.hourlyRate ?? '',
      e.payRateEffectiveDate, e.benefitClassCode, e.benefitClassDescription,
    ])
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `employee-compensation-${clientName.replace(/\s+/g, '-').toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Column definitions for the table ────────────────────────────────────
  const COLUMNS: {
    key: keyof EmployeeCompRow
    label: string
    width: string
    type: 'text' | 'number' | 'select' | 'date'
    options?: string[]
  }[] = [
    { key: 'employeeName', label: 'Employee Name', width: 'min-w-[160px]', type: 'text' },
    { key: 'employeeType', label: 'Employee Type', width: 'min-w-[160px]', type: 'select', options: EMPLOYEE_TYPES },
    { key: 'hireDate', label: 'Hire Date', width: 'min-w-[120px]', type: 'date' },
    { key: 'rehireDate', label: 'Rehire Date', width: 'min-w-[120px]', type: 'date' },
    { key: 'workLocation', label: 'Work Location', width: 'min-w-[140px]', type: 'text' },
    { key: 'jobTitle', label: 'Job Title', width: 'min-w-[150px]', type: 'text' },
    { key: 'payType', label: 'Hourly/Salary', width: 'min-w-[110px]', type: 'select', options: PAY_TYPES },
    { key: 'annualSalary', label: 'Annual Salary', width: 'min-w-[130px]', type: 'number' },
    { key: 'hourlyRate', label: 'Hourly Rate', width: 'min-w-[110px]', type: 'number' },
    { key: 'payRateEffectiveDate', label: 'Pay Rate Eff. Date', width: 'min-w-[130px]', type: 'date' },
    { key: 'benefitClassCode', label: 'Benefit Class Code', width: 'min-w-[130px]', type: 'text' },
    { key: 'benefitClassDescription', label: 'Benefit Class Desc.', width: 'min-w-[160px]', type: 'text' },
  ]

  // ══════════════════════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════════════════════

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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            {hasData && !composingNew
              ? 'Employee Compensation Report'
              : composingNew
                ? 'New Compensation Analysis'
                : 'Employee Compensation Analysis'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {hasData && !composingNew
              ? `Compensation census and payroll analysis for ${clientName}`
              : `Extract and manage employee compensation data for ${clientName}`}
          </p>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2 shrink-0">
            {hasData && !composingNew && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setComposingNew(true)
                  setMode('upload')
                  setError(null)
                }}
                className="gap-1.5 h-8 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200"
              >
                <Plus className="w-3.5 h-3.5 text-slate-500" />
                New Analysis
              </Button>
            )}
            {composingNew && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setComposingNew(false)
                  setError(null)
                }}
                className="h-8 text-xs font-medium text-slate-700"
              >
                Cancel
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Inline analyzing notification if analyzing while existing data is kept */}
      {analyzing && hasData && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50/60 text-amber-900 text-xs">
          <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
          <span className="font-medium">Extracting updated employee compensation data in the background…</span>
        </div>
      )}

      {/* Input Workspace Card: shown when no data yet or composing new run */}
      {!readOnly && (!hasData || composingNew) && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs space-y-6">
          {/* Mode Selector Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
            {INPUT_MODES.map(m => {
              const Icon = m.icon
              const active = mode === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setMode(m.key)
                    setError(null)
                  }}
                  className={cn(
                    'flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs transition-all',
                    active
                      ? 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border border-slate-200/80 hover:bg-slate-100 hover:text-slate-800 font-medium'
                  )}
                >
                  <Icon className={cn('w-3.5 h-3.5', active ? 'text-amber-700' : 'text-slate-400')} />
                  {m.label}
                </button>
              )
            })}
          </div>

          {/* Mode: Upload Document */}
          {mode === 'upload' && (
            <div className="space-y-4">
              {/* Sector Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Required Compensation Document
                    </h4>
                    <span
                      className={cn(
                        'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                        canAnalyzeUpload
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      )}
                    >
                      {canAnalyzeUpload ? '1 of 1 ready' : '0 of 1 ready'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadUploadedEmployeeDocs()}
                    disabled={loadingDocs}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={cn('w-3 h-3', loadingDocs && 'animate-spin')} />
                    Refresh
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Upload or select an employee list document from the client portal to extract compensation details.
                </p>
              </div>

              {/* Valuation-style Document Card Row */}
              <div
                {...getRootProps()}
                className={cn(
                  'rounded-xl border p-4 transition-all shadow-2xs relative',
                  isDragActive
                    ? 'border-amber-400 bg-amber-50/50 ring-2 ring-amber-300'
                    : canAnalyzeUpload
                      ? 'border-emerald-200 bg-emerald-50/40'
                      : isUnavailable
                        ? 'border-amber-200 bg-amber-50/40'
                        : 'border-slate-200/80 bg-white hover:border-slate-300'
                )}
              >
                <input {...getInputProps()} />

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                          canAnalyzeUpload
                            ? 'bg-emerald-50 text-emerald-600'
                            : isUnavailable
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-slate-100 text-slate-400'
                        )}
                      >
                        <FileSpreadsheet className="w-4.5 h-4.5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-800">
                            Employee List (titles, hours, compensation)
                          </p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                            Required
                          </span>
                          {canAnalyzeUpload ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Uploaded
                            </span>
                          ) : isUnavailable ? (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                              Not available with client
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                              Missing
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          Detailed employee census or payroll summary containing employee names, positions, full-time/part-time status, hire dates, and compensation. Supported: XLSX, XLS, CSV, PDF, PNG, JPG.
                        </p>

                        {/* Uploaded / Selected files chips */}
                        {(file || uploadedDocs.length > 0) && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {/* Local file if picked */}
                            {file && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-emerald-200 text-emerald-900 shadow-2xs">
                                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate max-w-[220px] font-semibold">{file.name}</span>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  ({(file.size / 1024).toFixed(0)} KB)
                                </span>
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                                  Local
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setFile(null)
                                  }}
                                  className="text-slate-400 hover:text-red-500 ml-1 font-bold text-sm leading-none"
                                  title="Remove local file"
                                >
                                  ×
                                </button>
                              </span>
                            )}

                            {/* Portal documents */}
                            {uploadedDocs.map((doc) => {
                              const supported = isSupportedEmployeeCompFile(doc.fileName)
                              const isSelected = !file && (selectedDocId ?? uploadedDocs[0]?.id) === doc.id
                              return (
                                <button
                                  key={doc.id}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (supported) {
                                      setFile(null)
                                      setSelectedDocId(doc.id)
                                      setError(null)
                                    }
                                  }}
                                  className={cn(
                                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border shadow-2xs transition-all text-left',
                                    isSelected
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 ring-1 ring-emerald-400'
                                      : supported
                                        ? 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                        : 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                                  )}
                                  title={supported ? 'Click to select this document for analysis' : 'Unsupported file format'}
                                >
                                  <FileSpreadsheet className={cn('w-3.5 h-3.5 shrink-0', isSelected ? 'text-emerald-600' : 'text-slate-400')} />
                                  <a
                                    href={`/api/client-documents/view?clientId=${encodeURIComponent(clientId)}&documentId=${encodeURIComponent(EMPLOYEE_LIST_DOCUMENT_ID)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="hover:underline truncate max-w-[200px]"
                                    title="View file in new tab"
                                  >
                                    {doc.fileName}
                                  </a>
                                  {doc.uploadedAt && (
                                    <span className="text-[10px] text-slate-400 font-normal">
                                      · {new Date(doc.uploadedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                  {isSelected && (
                                    <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-semibold">
                                      Selected
                                    </span>
                                  )}
                                  {!supported && (
                                    <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded font-medium">
                                      .numbers unsupported
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action button */}
                  <div className="shrink-0 pt-0.5">
                    <button
                      type="button"
                      onClick={openFileDialog}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      {canAnalyzeUpload ? 'Replace' : 'Upload'}
                    </button>
                  </div>
                </div>

                {isDragActive && (
                  <div className="mt-3 text-center py-2 text-xs font-semibold text-amber-800 bg-amber-100/70 rounded-lg">
                    Drop employee list file to upload...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mode: Paste Text */}
          {mode === 'paste' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Paste Payroll Data
                </h4>
                <p className="text-xs text-slate-500">
                  Paste raw payroll or census data directly from a spreadsheet, email, or report (e.g. employee names, job titles, annual salaries, hourly rates, hire dates).
                </p>
              </div>
              <textarea
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                placeholder="Employee Name    Job Title    Salary / Hourly    Hire Date&#10;John Smith       General Manager    $85,000/yr    2019-04-12&#10;Jane Doe         Operations Lead    $32.50/hr     2021-08-01"
                rows={9}
                className="w-full border border-slate-200 rounded-xl p-4 text-xs font-mono text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-y bg-slate-50/50"
              />
            </div>
          )}

          {/* Mode: Manual Entry */}
          {mode === 'manual' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Manual Compensation Entry
                </h4>
                <p className="text-xs text-slate-500">
                  Build or modify the compensation census manually in our interactive table workspace with full inline editing.
                </p>
              </div>
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                  <PenLine className="w-5 h-5" />
                </div>
                <div className="max-w-md mx-auto">
                  <p className="text-xs font-semibold text-slate-800">
                    {employees.length > 0 ? `${employees.length} employees currently in census` : 'No employees in census yet'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Open the table workspace to add rows, set pay rates, choose job titles and benefit classes.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    if (employees.length === 0) {
                      setEmployees([makeEmptyRow()])
                    }
                    setHasData(true)
                    setComposingNew(false)
                  }}
                  className="gap-1.5 h-8 text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {employees.length > 0 ? 'Open Table Workspace' : 'Add First Employee'}
                </Button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Bottom Readiness & Action Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-xs">
              {mode === 'upload' ? (
                canAnalyzeUpload ? (
                  <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Employee list document ready. You can extract compensation data.
                  </span>
                ) : (
                  <span className="text-amber-800 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    Upload or select an employee list document to extract data.
                  </span>
                )
              ) : mode === 'paste' ? (
                freeText.trim() ? (
                  <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Payroll text ready for extraction.
                  </span>
                ) : (
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                    Paste payroll data above to extract.
                  </span>
                )
              ) : (
                <span className="text-slate-600 font-medium">
                  Build census manually using the editable table.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {composingNew && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setComposingNew(false)
                    setError(null)
                  }}
                  className="h-8 text-xs font-medium text-slate-700"
                >
                  Cancel
                </Button>
              )}

              {mode !== 'manual' ? (
                <Button
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={
                    analyzing ||
                    (mode === 'upload' && !canAnalyzeUpload) ||
                    (mode === 'paste' && !freeText.trim())
                  }
                  className="gap-1.5 h-8 text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm disabled:opacity-50"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analyzing Payroll Data…
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Extract Compensation Data
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => {
                    if (employees.length === 0) {
                      setEmployees([makeEmptyRow()])
                    }
                    setHasData(true)
                    setComposingNew(false)
                  }}
                  className="gap-1.5 h-8 text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Open Table Workspace
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Active Report View ────────────────────────────────────────── */}
      {hasData && !composingNew && (
        <>
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 bg-white border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Total Headcount</p>
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Users2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{summary.totalHeadcount}</p>
              <p className="text-xs text-slate-400 mt-1">
                {summary.fullTimeCount} Full Time · {summary.partTimeCount} Part Time
              </p>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Annual Payroll</p>
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{formatCurrency(summary.totalAnnualPayroll)}</p>
              <p className="text-xs text-slate-400 mt-1">Total estimated compensation</p>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Avg Hourly Rate</p>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {summary.avgHourlyRate !== null ? `$${summary.avgHourlyRate.toFixed(2)}/hr` : '—'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Across hourly staff</p>
            </Card>

            <Card className="p-4 bg-white border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-500">Avg Annual Salary</p>
                <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {summary.avgSalary !== null ? formatCurrency(summary.avgSalary) : '—'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Across salaried staff</p>
            </Card>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Action bar */}
          <AdvisorActions className="flex flex-wrap items-center gap-3">
            <button
              onClick={addRow}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Row
            </button>
            <button
              onClick={exportCsv}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
            <ExportReportButton
              html={buildEmployeeCompReportHtml(employees, summary, clientName)}
              fileName={`employee-comp-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
              label="Export PDF"
            />
            <div className="flex-1" />
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold transition-all',
                saved
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-sm'
              )}
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  Save
                </>
              )}
            </button>
          </AdvisorActions>

          {!readOnly && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-2 text-xs text-amber-800">
            <PenLine className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Amber dashed cells are editable. Click any cell to update it, then save the table.</span>
          </div>
          )}

          {/* Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-center px-2 py-2.5 font-semibold text-slate-400 w-[40px]">#</th>
                    {COLUMNS.map(col => (
                      <Fragment key={col.key}>
                        <th className={cn('text-left px-3 py-2.5 font-semibold text-slate-500', col.width)}>
                          {col.label}
                        </th>
                        {col.key === 'employeeType' && (
                          <>
                            <th className="text-left px-3 py-2.5 font-semibold text-slate-500 min-w-[120px]">Full Time Employees</th>
                            <th className="text-left px-3 py-2.5 font-semibold text-slate-500 min-w-[120px]">Part Time Employees</th>
                          </>
                        )}
                      </Fragment>
                    ))}
                    <th className="text-center px-2 py-2.5 font-semibold text-slate-400 w-[50px]" />
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, i) => (
                    <tr key={emp.id} className="border-b border-slate-50 hover:bg-amber-50/20 transition-colors group">
                      <td className="text-center px-2 py-1 text-slate-300 font-mono">{i + 1}</td>
                      {COLUMNS.map(col => (
                        <Fragment key={col.key}>
                          <td className={cn('px-2 py-1', col.width)}>
                            <EditableCell
                              value={emp[col.key] as any}
                              onChange={val => updateRow(emp.id, col.key, val)}
                              type={col.type}
                              options={col.options}
                            />
                          </td>
                          {col.key === 'employeeType' && (
                            <>
                              <td className="px-3 py-1 text-xs text-slate-700">{emp.employeeType.toLowerCase().includes('full') ? '1' : ''}</td>
                              <td className="px-3 py-1 text-xs text-slate-700">{emp.employeeType.toLowerCase().includes('part') ? '1' : ''}</td>
                            </>
                          )}
                        </Fragment>
                      ))}
                      <td className="text-center px-2 py-1">
                        <button
                          onClick={() => deleteRow(emp.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
                          title="Delete row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr>
                      <td colSpan={COLUMNS.length + 4} className="text-center py-12 text-slate-300 text-sm">
                        No employees yet. Click &ldquo;Add Row&rdquo; to start.
                      </td>
                    </tr>
                  )}
                </tbody>
                {employees.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-semibold text-xs text-slate-700">
                      <td className="text-center px-2 py-2.5" />
                      {/* Employee Name col — show count */}
                      <td className="px-3 py-2.5">{summary.totalHeadcount} employees</td>
                      {/* Employee Type col — FT/PT split */}
                      <td className="px-3 py-2.5">{summary.fullTimeCount} FT / {summary.partTimeCount} PT</td>
                      {/* Full Time Employees */}
                      <td className="px-3 py-2.5">{summary.fullTimeCount}</td>
                      {/* Part Time Employees */}
                      <td className="px-3 py-2.5">{summary.partTimeCount}</td>
                      {/* Hire Date */}
                      <td className="px-3 py-2.5" />
                      {/* Rehire Date */}
                      <td className="px-3 py-2.5" />
                      {/* Work Location */}
                      <td className="px-3 py-2.5" />
                      {/* Job Title */}
                      <td className="px-3 py-2.5" />
                      {/* Hourly/Salary */}
                      <td className="px-3 py-2.5" />
                      {/* Annual Salary — total payroll */}
                      <td className="px-3 py-2.5">{formatCurrency(summary.totalAnnualPayroll)}</td>
                      {/* Hourly Rate — avg */}
                      <td className="px-3 py-2.5">{summary.avgHourlyRate !== null ? `$${summary.avgHourlyRate.toFixed(2)}/hr` : '\u2014'}</td>
                      {/* Pay Rate Eff Date */}
                      <td className="px-3 py-2.5" />
                      {/* Benefit Class Code */}
                      <td className="px-3 py-2.5" />
                      {/* Benefit Class Desc */}
                      <td className="px-3 py-2.5" />
                      {/* Delete col */}
                      <td className="px-2 py-2.5" />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>

          {/* Reset button */}
          <div className="flex justify-end">
            <button
              onClick={() => {
                if (window.confirm('Clear all data and start over?')) {
                  setEmployees([])
                  setHasData(false)
                  setFile(null)
                  setFreeText('')
                  setError(null)
                  setSaved(false)
                }
              }}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              Clear &amp; Start Over
            </button>
          </div>
        </>
      )}
    </div>
  )
}
