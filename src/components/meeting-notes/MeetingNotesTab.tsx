'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bot, FileText, Loader2, RefreshCw } from 'lucide-react'
import { Badge, Button, Card } from '@/components/ui'

interface Props {
  clientId: string
  clientName: string
}

interface MeetingReport {
  title: string
  date: string
  summary: string
  actionItems: string[]
  keyDecisions: string[]
  followUps: Array<{ item: string; owner: string; dueDate: string }>
  generatedAt: string
}

export default function MeetingNotesTab({ clientId, clientName }: Props) {
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [hasNotes, setHasNotes] = useState(false)
  const [reports, setReports] = useState<MeetingReport[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/client-documents?clientId=${encodeURIComponent(clientId)}&documentId=meeting_notes`, { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setHasNotes(!!data?.document)
        if (data?.reports) setReports(data.reports)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [clientId])

  useEffect(() => { void load() }, [load])

  const runAnalysis = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch('/api/meeting-notes/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      })
      if (!res.ok) throw new Error(await res.text() || 'Analysis failed')
      const report = await res.json()
      setReports(prev => [report, ...prev])
    } catch (err: any) {
      setError(err.message || 'Failed to generate report')
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
              <h3 className="text-sm font-semibold text-slate-800">Meeting Notes Agent</h3>
              <p className="text-xs text-slate-400 mt-0.5">Upload meeting notes or call transcripts to generate structured reports with action items, key decisions, and follow-ups.</p>
            </div>
          </div>
          <Button size="sm" onClick={runAnalysis} disabled={!hasNotes || running}>
            {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {running ? 'Generating...' : 'Generate Report'}
          </Button>
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {!hasNotes && reports.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center space-y-3">
          <FileText className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-600">No meeting notes uploaded yet</p>
          <p className="text-xs text-slate-400">Upload meeting notes or call transcripts in the <strong>Documents</strong> tab to generate structured reports.</p>
        </div>
      )}

      {reports.map((report, idx) => (
        <Card key={idx} className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">{report.title || 'Meeting Report'}</h4>
              <p className="text-xs text-slate-400 mt-0.5">{report.date || 'Date unknown'} · Generated {new Date(report.generatedAt).toLocaleString()}</p>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Summary</p>
            <p className="text-sm text-slate-700 leading-relaxed">{report.summary}</p>
          </div>

          {report.actionItems?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Action Items</p>
              <div className="space-y-1.5">
                {report.actionItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.keyDecisions?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Key Decisions</p>
              <div className="space-y-1.5">
                {report.keyDecisions.map((dec, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 shrink-0" />
                    {dec}
                  </div>
                ))}
              </div>
            </div>
          )}

          {report.followUps?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Follow-ups</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Item</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Owner</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.followUps.map((fu, i) => (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="py-2 px-3 text-slate-700">{fu.item}</td>
                        <td className="py-2 px-3 text-slate-600">{fu.owner}</td>
                        <td className="py-2 px-3 text-slate-500">{fu.dueDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
