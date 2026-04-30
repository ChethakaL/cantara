'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload, FileText, Plus, Trash2, Download, Save, Users2,
  DollarSign, Clock, Building2, AlertTriangle, CheckCircle,
  FileSpreadsheet, Type, PenLine,
} from 'lucide-react'
import { Card, cn } from '@/components/ui'
import type { EmployeeCompRow, EmployeeCompReport } from '@/lib/employee-comp/analyze'

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
        className="w-full bg-transparent text-xs text-slate-700 border-0 focus:ring-1 focus:ring-amber-300 rounded px-1 py-1 cursor-pointer"
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
          'min-h-[28px] px-1 py-1 rounded cursor-pointer hover:bg-amber-50/50 transition-colors flex items-center text-xs text-slate-700',
          !value && 'text-slate-300 italic',
          className
        )}
        title="Click to edit"
      >
        {type === 'number' && value !== null && value !== '' ? formatCurrency(Number(value)) : (value ?? '')}
        {!value && '\u2014'}
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
}: {
  clientId: string
  clientName: string
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

  // Load saved data on mount
  useEffect(() => {
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
      } catch { /* ignore */ }
    }
    loadSaved()
  }, [clientId])

  const summary = recalcSummary(employees)

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      setFile(accepted[0])
      setError(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    multiple: false,
  })

  // ── Analyze ─────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    setAnalyzing(true)
    setError(null)
    try {
      let res: Response
      if (mode === 'upload') {
        if (!file) throw new Error('Please upload a file first')
        const formData = new FormData()
        formData.append('file', file)
        res = await fetch('/api/employee-comp/analyze', { method: 'POST', body: formData })
      } else {
        if (!freeText.trim()) throw new Error('Please paste some payroll data first')
        res = await fetch('/api/employee-comp/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ freeText }),
        })
      }

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Analysis failed (${res.status})`)
      }
      const data: EmployeeCompReport = await res.json()
      setEmployees(data.employees)
      setHasData(true)
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
      'Employee Name', 'Hire Date', 'Rehire Date', 'Employee Type', 'Work Location',
      'Job Title', 'Hourly/Salary', 'Annual Salary', 'Hourly Rate',
      'Pay Rate Effective Date', 'Benefit Class Code', 'Benefit Class Description',
    ]
    const rows = employees.map(e => [
      e.employeeName, e.hireDate, e.rehireDate, e.employeeType, e.workLocation,
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
    { key: 'hireDate', label: 'Hire Date', width: 'min-w-[120px]', type: 'date' },
    { key: 'rehireDate', label: 'Rehire Date', width: 'min-w-[120px]', type: 'date' },
    { key: 'employeeType', label: 'Employee Type', width: 'min-w-[160px]', type: 'select', options: EMPLOYEE_TYPES },
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
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Employee Compensation Report</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Extract and manage employee compensation data for {clientName}
        </p>
        <p className="text-xs text-slate-400 mt-1">Payroll and compensation reports can also be uploaded in the Documents tab.</p>
      </div>

      {/* Summary cards (always visible once we have data) */}
      {hasData && employees.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Users2 className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{summary.totalHeadcount}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">Total Headcount</p>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {summary.fullTimeCount} <span className="text-xs font-normal text-slate-400">FT</span>
              {' / '}
              {summary.partTimeCount} <span className="text-xs font-normal text-slate-400">PT</span>
            </p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">FT / PT Split</p>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{formatCurrency(summary.totalAnnualPayroll)}</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">Total Annual Payroll</p>
          </Card>
          <Card className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {summary.avgHourlyRate !== null ? `$${summary.avgHourlyRate.toFixed(2)}/hr` : '\u2014'}
            </p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wide mt-1">Avg Hourly Rate</p>
          </Card>
        </div>
      )}

      {/* Input mode selector */}
      {!hasData && (
        <>
          <div className="flex gap-2">
            {INPUT_MODES.map(m => {
              const Icon = m.icon
              const active = mode === m.key
              return (
                <button
                  key={m.key}
                  onClick={() => { setMode(m.key); setError(null) }}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all',
                    active
                      ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-sm'
                      : 'bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {m.label}
                </button>
              )
            })}
          </div>

          {/* Upload mode */}
          {mode === 'upload' && (
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
                  isDragActive
                    ? 'border-amber-400 bg-amber-50/50'
                    : file
                      ? 'border-emerald-300 bg-emerald-50/30'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                )}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-emerald-500" />
                    <p className="text-sm font-medium text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-400">Click or drag to replace</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-8 h-8 text-slate-300" />
                    <p className="text-sm text-slate-500">
                      {isDragActive ? 'Drop file here...' : 'Drag & drop a payroll document, or click to browse'}
                    </p>
                    <p className="text-xs text-slate-400">PDF, PNG, JPG, XLSX, XLS, or CSV</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Paste mode */}
          {mode === 'paste' && (
            <div className="space-y-4">
              <textarea
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                placeholder="Paste payroll data here... (e.g. employee name, title, salary, hourly rate, hire date, etc.)"
                rows={10}
                className="w-full border border-slate-200 rounded-xl p-4 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-y"
              />
            </div>
          )}

          {/* Manual mode */}
          {mode === 'manual' && (
            <Card className="p-5">
              <p className="text-sm text-slate-600 mb-3">
                Start adding employees manually. Click the button below to create your first row.
              </p>
              <button
                onClick={addRow}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add First Employee
              </button>
            </Card>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Analyze button (upload & paste modes only) */}
          {mode !== 'manual' && (
            <button
              onClick={handleAnalyze}
              disabled={(mode === 'upload' && !file) || (mode === 'paste' && !freeText.trim()) || analyzing}
              className={cn(
                'flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all w-full md:w-auto',
                ((mode === 'upload' && file) || (mode === 'paste' && freeText.trim())) && !analyzing
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-sm'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              )}
            >
              {analyzing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing Payroll Data...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-4 h-4" />
                  Extract Compensation Data
                </>
              )}
            </button>
          )}
        </>
      )}

      {/* ── Editable Workbook Table ──────────────────────────────────────── */}
      {hasData && (
        <>
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Action bar */}
          <div className="flex flex-wrap items-center gap-3">
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
          </div>

          {/* Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-center px-2 py-2.5 font-semibold text-slate-400 w-[40px]">#</th>
                    {COLUMNS.map(col => (
                      <th key={col.key} className={cn('text-left px-3 py-2.5 font-semibold text-slate-500', col.width)}>
                        {col.label}
                      </th>
                    ))}
                    <th className="text-center px-2 py-2.5 font-semibold text-slate-400 w-[50px]" />
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, i) => (
                    <tr key={emp.id} className="border-b border-slate-50 hover:bg-amber-50/20 transition-colors group">
                      <td className="text-center px-2 py-1 text-slate-300 font-mono">{i + 1}</td>
                      {COLUMNS.map(col => (
                        <td key={col.key} className={cn('px-2 py-1', col.width)}>
                          <EditableCell
                            value={emp[col.key] as any}
                            onChange={val => updateRow(emp.id, col.key, val)}
                            type={col.type}
                            options={col.options}
                          />
                        </td>
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
                      <td colSpan={COLUMNS.length + 2} className="text-center py-12 text-slate-300 text-sm">
                        No employees yet. Click &ldquo;Add Row&rdquo; to start.
                      </td>
                    </tr>
                  )}
                </tbody>
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
