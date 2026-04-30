'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, Star, AlertTriangle, CheckCircle, RefreshCw, FileText } from 'lucide-react'
import { Card, Badge, cn } from '@/components/ui'
import type { OrgChartAnalysis } from '@/lib/org-chart/analyze'

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
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Upload New Chart
          </button>
        </div>

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
          <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
        </Card>

        {/* Headcount */}
        {result.totalHeadcount !== null && (
          <Card className="p-5 text-center max-w-[200px]">
            <p className="text-3xl font-bold text-slate-800">{result.totalHeadcount}</p>
            <p className="text-xs text-slate-400 mt-1">Total Headcount</p>
          </Card>
        )}

        {/* Roles Table */}
        {result.roles.length > 0 && (
          <Card className="overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">Roles ({result.roles.length})</h3>
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
                  </tr>
                </thead>
                <tbody>
                  {result.roles.map((role, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-700">{role.name}</td>
                      <td className="px-4 py-2.5 text-slate-600">{role.title}</td>
                      <td className="px-4 py-2.5 text-slate-600">{role.department}</td>
                      <td className="px-4 py-2.5 text-slate-600">{role.reportsTo}</td>
                      <td className="px-4 py-2.5 text-center">
                        {role.keyPerson && <Star className="w-3.5 h-3.5 text-amber-500 mx-auto fill-amber-500" />}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge color={RISK_COLORS[role.transitionRisk] as 'red' | 'gold' | 'green'}>
                          {role.transitionRisk}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Key Person Dependencies */}
        {result.keyPersonDependencies.length > 0 && (
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Key Person Dependencies</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {result.keyPersonDependencies.map((dep, i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-start gap-3">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
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
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Role Gaps */}
        {result.roleGaps.length > 0 && (
          <Card className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Role Gaps</h3>
            <ul className="space-y-1.5">
              {result.roleGaps.map((gap, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="text-amber-500 mt-1 flex-shrink-0">&bull;</span>
                  {gap}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Recommendations */}
        {result.recommendations.length > 0 && (
          <Card className="p-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Recommendations</h3>
            <ol className="space-y-2">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {rec}
                </li>
              ))}
            </ol>
          </Card>
        )}
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
