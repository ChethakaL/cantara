'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Star, AlertTriangle, CheckCircle, RefreshCw, FileText, Save, Pencil } from 'lucide-react'
import { Card, Badge, cn } from '@/components/ui'
import type { OrgChartAnalysis } from '@/lib/org-chart/analyze'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { buildOrgChartReportHtml } from '@/lib/report-export/build-org-chart-report'

const ACCEPTED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
  'text/csv': ['.csv'],
}

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
}: {
  clientId: string
  clientName: string
}) {
  const [file, setFile] = useState<File | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<OrgChartAnalysis | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedBadge, setSavedBadge] = useState(false)

  // Load saved data on mount
  useEffect(() => {
    const loadSaved = async () => {
      try {
        const res = await fetch(`/api/client-data/${clientId}?section=orgChart`)
        if (res.ok) {
          const data = await res.json()
          if (data && data.summary) {
            setResult(data)
          }
        }
      } catch { /* ignore */ }
    }
    loadSaved()
  }, [clientId])

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

  const handleAnalyze = async () => {
    if (!file) return
    setAnalyzing(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
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
      try {
        const saveRes = await fetch(`/api/client-data/${clientId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section: 'orgChart', data }),
        })
        if (!saveRes.ok) throw new Error('Save failed')
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

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setError(null)
    setEditMode(false)
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

  // ── Results view ──────────────────────────────────────────────────────────
  if (result) {
    const readiness = READINESS_CONFIG[result.transitionReadiness] || READINESS_CONFIG.medium
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Org Chart Analysis</h2>
            <p className="text-xs text-slate-400 mt-0.5">{clientName} &mdash; Generated {new Date(result.generatedAt).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setEditMode(e => !e)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-colors',
                editMode
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-sm transition-all"
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
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Upload New Chart
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
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
              <p className="text-3xl font-bold text-slate-800">{result.totalHeadcount}</p>
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
              <button onClick={() => addListItem('roleGaps')} className="text-xs text-amber-600 hover:text-amber-800 font-medium">
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

  // ── Upload view ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Org Chart Upload &amp; Review</h2>
        <p className="text-xs text-slate-400 mt-0.5">Upload an org chart to analyze key-person dependencies and transition readiness for {clientName}</p>
        <p className="text-xs text-slate-400 mt-1">Org charts can also be uploaded in the Documents tab.</p>
      </div>

      {/* Dropzone */}
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
              {isDragActive ? 'Drop file here...' : 'Drag & drop an org chart, or click to browse'}
            </p>
            <p className="text-xs text-slate-400">PDF, PNG, JPG, XLSX, XLS, or CSV</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-3 rounded-lg">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={!file || analyzing}
        className={cn(
          'flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all w-full md:w-auto',
          file && !analyzing
            ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-sm'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        )}
      >
        {analyzing ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Analyzing Org Chart...
          </>
        ) : (
          <>
            <Star className="w-4 h-4" />
            Analyze Org Chart
          </>
        )}
      </button>
    </div>
  )
}
