'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Bot, CheckCircle, FileText, Loader2, RefreshCw, Save, Trash2, Upload } from 'lucide-react'
import { Badge, Button, Textarea } from '@/components/ui'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { buildSalesReviewReportHtml } from '@/lib/report-export/build-sales-review-report'
import { getAdminEmail } from '@/lib/store'
import type { SalesProcessReviewResult } from '@/lib/sales-review/types'

interface Props {
  clientId: string
  clientName: string
}

async function readFriendlyError(res: Response, fallback: string) {
  const text = await res.text().catch(() => '')
  if (res.status === 404 && /This page could not be found|<!DOCTYPE html/i.test(text)) {
    return 'Sales Process Review analysis endpoint is not implemented yet.'
  }
  if (/<!DOCTYPE html/i.test(text)) {
    return `${fallback} Server returned an HTML error page instead of a JSON response.`
  }
  return text.trim() || fallback
}

function splitLines(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean)
}

function makeDraft(result: SalesProcessReviewResult) {
  return {
    summary: result.summary,
    keyFindings: result.keyFindings.join('\n'),
    benchmarkComparisons: result.benchmarkComparisons
      .map((row) => `${row.metric} | ${row.actual} | ${row.benchmark} | ${row.status}`)
      .join('\n'),
    recommendations: result.recommendations.join('\n'),
  }
}

function parseDraft(draft: ReturnType<typeof makeDraft>, generatedAt: string): SalesProcessReviewResult {
  const benchmarkComparisons: SalesProcessReviewResult['benchmarkComparisons'] = splitLines(draft.benchmarkComparisons).map((line) => {
    const [metric = '', actual = '', benchmark = '', rawStatus = 'at'] = line.split('|').map((part) => part.trim())
    const status: SalesProcessReviewResult['benchmarkComparisons'][number]['status'] =
      rawStatus === 'above' || rawStatus === 'below' || rawStatus === 'at' ? rawStatus : 'at'
    return { metric, actual, benchmark, status }
  }).filter((row) => row.metric || row.actual || row.benchmark)

  return {
    summary: draft.summary.trim() || 'No summary provided.',
    keyFindings: splitLines(draft.keyFindings),
    benchmarkComparisons,
    recommendations: splitLines(draft.recommendations),
    generatedAt,
  }
}

function statusColor(status: SalesProcessReviewResult['benchmarkComparisons'][number]['status']): 'red' | 'gold' | 'green' {
  if (status === 'above') return 'green'
  if (status === 'below') return 'red'
  return 'gold'
}

export default function SalesProcessReviewTab({ clientId, clientName }: Props) {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [hasTranscript, setHasTranscript] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [result, setResult] = useState<SalesProcessReviewResult | null>(null)
  const [draft, setDraft] = useState<ReturnType<typeof makeDraft> | null>(null)
  const [error, setError] = useState<string | null>(null)

  const editMode = Boolean(draft)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    if (!opts?.silent) setError(null)
    try {
      const res = await fetch(`/api/client-documents?clientId=${encodeURIComponent(clientId)}&documentId=sales_process_transcript`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await readFriendlyError(res, 'Failed to load sales process review.'))
      const data = await res.json()
      setHasTranscript(!!data?.document)
      setFileName(data?.document?.fileName ?? null)
      setResult(data?.analysis ?? null)
      setDraft(null)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load sales process review')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [clientId])

  useEffect(() => { void load() }, [load])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    setFileName(file.name)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', clientId)
      formData.append('documentId', 'sales_process_transcript')
      formData.append('uploaderEmail', getAdminEmail())
      const res = await fetch('/api/client-documents/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await readFriendlyError(res, 'Upload failed.'))
      setHasTranscript(true)
      await load({ silent: true })
    } catch (err: any) {
      setError(err?.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const runAnalysis = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/sales-review/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      if (!res.ok) throw new Error(await readFriendlyError(res, 'Analysis failed.'))
      setResult(await res.json())
      setDraft(null)
    } catch (err: any) {
      setError(err.message || 'Failed to run analysis')
    } finally {
      setRunning(false)
    }
  }

  const saveEditedResult = async () => {
    if (!draft || !result) return
    const next = parseDraft(draft, result.generatedAt || new Date().toISOString())
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/sales-review/analyze', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, result: next }),
      })
      if (!res.ok) throw new Error(await readFriendlyError(res, 'Failed to save sales process review.'))
      setResult(await res.json())
      setDraft(null)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save sales process review')
    } finally {
      setSaving(false)
    }
  }

  const resetReview = async () => {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/client-documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, documentId: 'sales_process_transcript' }),
      })
      if (!res.ok) throw new Error(await readFriendlyError(res, 'Failed to reset sales process review.'))
      setHasTranscript(false)
      setFileName(null)
      setResult(null)
      setDraft(null)
    } catch (err: any) {
      setError(err?.message ?? 'Failed to reset sales process review')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
              <Bot className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Sales Process Review</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload a transcript to assess discovery quality, conversion process, follow-up discipline, and booking performance.
              </p>
              {fileName && <p className="text-[11px] text-slate-400 mt-1">Transcript: {fileName}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {result && !editMode && (
              <>
                <Button size="sm" variant="outline" onClick={() => setDraft(makeDraft(result))}>Edit Output</Button>
                <ExportReportButton
                  html={buildSalesReviewReportHtml(result, clientName)}
                  fileName={`sales-process-review-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
                  label="Export PDF"
                />
              </>
            )}
            {editMode && (
              <>
                <Button size="sm" variant="outline" onClick={() => setDraft(null)} disabled={saving}>Cancel</Button>
                <Button size="sm" onClick={() => void saveEditedResult()} disabled={saving}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </>
            )}
            {hasTranscript && (
              <Button size="sm" variant="danger" onClick={() => void resetReview()} disabled={running || uploading || saving || deleting}>
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {deleting ? 'Deleting...' : 'Reset'}
              </Button>
            )}
            <Button size="sm" onClick={runAnalysis} disabled={!hasTranscript || running || uploading || saving}>
              {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {running ? 'Analyzing...' : result ? 'Re-run' : 'Run Analysis'}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Sales Process Review could not run</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      )}

      {!hasTranscript && !running && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center space-y-3">
          <FileText className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-600">No transcript uploaded yet</p>
          <p className="text-xs text-slate-400">Upload a sales call transcript or meeting recording transcript to enable analysis.</p>
          <div className="mt-4 text-center">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-medium cursor-pointer hover:bg-amber-100 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Uploading...' : 'Upload Transcript'}
              <input type="file" accept=".pdf,.txt,.doc,.docx" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>
        </div>
      )}

      {running && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-amber-500 mx-auto animate-spin" />
          <p className="text-sm font-medium text-amber-800">Analyzing sales process...</p>
          <p className="text-xs text-amber-600">Reviewing transcript against sales conversion and booking benchmarks.</p>
        </div>
      )}

      {result && !editMode && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: 'Key Findings', value: result.keyFindings.length },
              { label: 'Benchmarks', value: result.benchmarkComparisons.length },
              { label: 'Recommendations', value: result.recommendations.length },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                <p className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">{item.label}</p>
                <p className="text-lg font-bold text-slate-800 mt-1">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              Summary
            </div>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{result.summary}</p>
          </div>

          {result.keyFindings.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h4 className="text-sm font-semibold text-slate-800">Key Findings</h4>
              <ul className="space-y-2">
                {result.keyFindings.map((finding, i) => (
                  <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    {finding}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.benchmarkComparisons.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h4 className="text-sm font-semibold text-slate-800">Benchmark Comparisons</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Metric</th>
                      <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Actual</th>
                      <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Benchmark</th>
                      <th className="text-right py-2 px-3 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.benchmarkComparisons.map((row, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="py-2 px-3 font-medium text-slate-700">{row.metric}</td>
                        <td className="py-2 px-3 text-slate-600">{row.actual}</td>
                        <td className="py-2 px-3 text-slate-600">{row.benchmark}</td>
                        <td className="py-2 px-3 text-right"><Badge color={statusColor(row.status)}>{row.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.recommendations.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
              <h4 className="text-sm font-semibold text-slate-800">Recommendations</h4>
              <ol className="list-decimal list-inside space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-slate-700 leading-relaxed">{rec}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex justify-center">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-medium cursor-pointer hover:bg-slate-50 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
              Upload New Transcript
              <input type="file" accept=".pdf,.txt,.doc,.docx" className="hidden" onChange={handleFileUpload} disabled={uploading || running} />
            </label>
          </div>
        </>
      )}

      {result && editMode && draft && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <h4 className="text-sm font-semibold text-slate-800">Edit Sales Process Review</h4>
          <Textarea label="Summary" rows={6} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} />
          <Textarea label="Key Findings (one per line)" rows={7} value={draft.keyFindings} onChange={(event) => setDraft({ ...draft, keyFindings: event.target.value })} />
          <Textarea
            label="Benchmark Comparisons (metric | actual | benchmark | status)"
            rows={6}
            value={draft.benchmarkComparisons}
            onChange={(event) => setDraft({ ...draft, benchmarkComparisons: event.target.value })}
          />
          <Textarea label="Recommendations (one per line)" rows={7} value={draft.recommendations} onChange={(event) => setDraft({ ...draft, recommendations: event.target.value })} />
        </div>
      )}
    </div>
  )
}
