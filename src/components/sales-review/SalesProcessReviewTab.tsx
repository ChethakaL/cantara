'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot, FileText, Loader2, RefreshCw, Upload } from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'
import { getAdminEmail } from '@/lib/store'

interface Props {
  clientId: string
  clientName: string
}

interface ReviewResult {
  summary: string
  keyFindings: string[]
  benchmarkComparisons: Array<{ metric: string; actual: string; benchmark: string; status: 'above' | 'below' | 'at' }>
  recommendations: string[]
  generatedAt: string
}

export default function SalesProcessReviewTab({ clientId, clientName }: Props) {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [hasTranscript, setHasTranscript] = useState(false)
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Check for existing transcript document
      const res = await fetch(`/api/client-documents?clientId=${encodeURIComponent(clientId)}&documentId=sales_process_transcript`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setHasTranscript(!!data?.document)
        if (data?.analysis) setResult(data.analysis)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [clientId])

  useEffect(() => { void load() }, [load])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clientId', clientId)
      formData.append('documentId', 'sales_process_transcript')
      formData.append('uploaderEmail', getAdminEmail())
      const res = await fetch('/api/client-documents/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error(await res.text() || 'Upload failed')
      setHasTranscript(true)
      await load()
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
      if (!res.ok) throw new Error(await res.text() || 'Analysis failed')
      setResult(await res.json())
    } catch (err: any) {
      setError(err.message || 'Failed to run analysis')
    }
    setRunning(false)
  }

  if (loading) {
    return <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
              <Bot className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Sales Process Review</h3>
              <p className="text-xs text-slate-400 mt-0.5">Evaluates current sales and conversion process, booking efficiency, and lead-to-client conversion rates against pet resort industry benchmarks.</p>
            </div>
          </div>
          <Button size="sm" onClick={runAnalysis} disabled={!hasTranscript || running}>
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {running ? 'Analyzing...' : 'Run Analysis'}
          </Button>
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {!hasTranscript && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center space-y-3">
          <FileText className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-600">No transcript uploaded yet</p>
          <p className="text-xs text-slate-400">Upload a sales call transcript or meeting recording transcript in the <strong>Documents</strong> tab to enable analysis.</p>
          <div className="mt-4 text-center">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-xs font-medium cursor-pointer hover:bg-amber-100 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              {uploading ? 'Uploading...' : 'Or upload here'}
              <input type="file" accept=".pdf,.txt,.doc,.docx" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Summary</p>
            <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
          </Card>

          {result.keyFindings?.length > 0 && (
            <Card className="p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Key Findings</p>
              <div className="space-y-2">
                {result.keyFindings.map((finding, i) => (
                  <p key={i} className="text-sm text-slate-700">{finding}</p>
                ))}
              </div>
            </Card>
          )}

          {result.benchmarkComparisons?.length > 0 && (
            <Card className="p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Benchmark Comparisons</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Metric</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">Actual</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">Benchmark</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.benchmarkComparisons.map((row, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="py-2 px-3 text-slate-700">{row.metric}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-800">{row.actual}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-500">{row.benchmark}</td>
                        <td className="py-2 px-3 text-right">
                          <Badge color={row.status === 'above' ? 'green' : row.status === 'below' ? 'red' : 'gold'}>{row.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {result.recommendations?.length > 0 && (
            <Card className="p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Recommendations</p>
              <div className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <p className="text-sm text-slate-700">{rec}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
