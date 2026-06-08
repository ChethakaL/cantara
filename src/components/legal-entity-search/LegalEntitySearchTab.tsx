'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, Button, cn } from '@/components/ui'
import { useWS110Analysis, type UploadedDoc } from '@/hooks/useWS110Analysis'
import { parseWS110Markdown } from '@/lib/ws1-10/parser'
import type { WS110Persistence, WS110Flag } from '@/types/ws1-10-types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { buildLegalEntitySearchReportHtml } from '@/lib/report-export/build-legal-entity-search-report'
import { Upload, FileText, X, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

// ── Document Uploader ───────────────────────────────────────────────────────

function DocumentUploader({
  onDocumentsReady,
  onAnalyze,
  isLoading,
}: {
  onDocumentsReady: (docs: UploadedDoc[]) => void
  onAnalyze: () => void
  isLoading: boolean
}) {
  const [files, setFiles] = useState<UploadedDoc[]>([])

  const handleFiles = useCallback(async (fileList: FileList) => {
    const newDocs: UploadedDoc[] = []
    for (const file of Array.from(fileList)) {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      newDocs.push({
        name: file.name,
        base64,
        mediaType: file.type || 'application/octet-stream',
        slotKey: 'legal_docs',
        sizeBytes: file.size,
      })
    }
    const updated = [...files, ...newDocs]
    setFiles(updated)
    onDocumentsReady(updated)
  }, [files, onDocumentsReady])

  const removeFile = (name: string) => {
    const updated = files.filter(f => f.name !== name)
    setFiles(updated)
    onDocumentsReady(updated)
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center">
          <FileText className="w-8 h-8 text-stone-400" />
        </div>
        <h3 className="text-xl font-semibold text-stone-900 tracking-tight">Legal Reports & Entity Search</h3>
        <p className="text-stone-500 text-sm max-w-lg mx-auto">
          Upload corporate documents, Secretary of State filings, UCC search results, certificates of good standing,
          trademark registrations, and registered agent confirmations for AI-powered legal due diligence analysis.
        </p>
      </div>

      <label className="block border-2 border-dashed border-stone-300 rounded-xl p-8 text-center cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all">
        <Upload className="w-6 h-6 text-stone-400 mx-auto mb-2" />
        <span className="text-sm text-stone-600 font-medium">Drop files or click to upload</span>
        <span className="block text-xs text-stone-400 mt-1">PDF, DOCX, XLSX, PNG, JPG</span>
        <input
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
          className="hidden"
          onChange={e => e.target.files && handleFiles(e.target.files)}
        />
      </label>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map(f => (
            <div key={f.name} className="flex items-center gap-3 px-4 py-2.5 bg-stone-50 rounded-lg border border-stone-200">
              <FileText className="w-4 h-4 text-stone-400 flex-shrink-0" />
              <span className="text-sm text-stone-700 flex-1 truncate">{f.name}</span>
              <span className="text-xs text-stone-400">{((f.sizeBytes ?? 0) / 1024).toFixed(0)} KB</span>
              <button onClick={() => removeFile(f.name)} className="text-stone-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button onClick={onAnalyze} disabled={isLoading} className="w-full mt-4">
            {isLoading ? 'Analyzing...' : `Analyze ${files.length} Document${files.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Flag Review Panel ───────────────────────────────────────────────────────

function FlagReviewPanel({
  flags,
  onConfirm,
  onNA,
}: {
  flags: WS110Flag[]
  onConfirm: (id: string) => void
  onNA: (id: string) => void
}) {
  const severityColor = (s: string) => {
    if (s === 'deal-risk') return 'bg-red-50 border-red-200 text-red-700'
    if (s === 'negotiation') return 'bg-amber-50 border-amber-200 text-amber-700'
    return 'bg-emerald-50 border-emerald-200 text-emerald-700'
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-bold text-stone-800 uppercase tracking-wider">Flag Review</h4>
      {flags.length === 0 && <p className="text-sm text-stone-400">No flags identified.</p>}
      {flags.map(flag => (
        <div key={flag.id} className={cn('p-4 rounded-xl border', severityColor(flag.severity))}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">{flag.domain}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">{flag.severity}</span>
              </div>
              <p className="text-sm font-medium">{flag.title}</p>
              {flag.sourceRef && <p className="text-xs opacity-60 mt-1">Source: {flag.sourceRef}</p>}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {flag.status === 'pending' ? (
                <>
                  <button
                    onClick={() => onConfirm(flag.id)}
                    className="p-1.5 rounded-lg bg-white/80 hover:bg-white border border-current/20 transition-colors"
                    title="Confirm flag"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onNA(flag.id)}
                    className="p-1.5 rounded-lg bg-white/80 hover:bg-white border border-current/20 transition-colors"
                    title="Mark N/A"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <span className="text-xs font-semibold px-2 py-1 rounded-md bg-white/60">
                  {flag.status === 'confirmed' ? 'Confirmed' : 'N/A'}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ──────────────────────────────────────────────────────────

interface LegalEntitySearchTabProps {
  clientId: string
  clientName: string
  state?: string
  dba?: string
  entityType?: string
  businessAddress?: string
}

export default function LegalEntitySearchTab({
  clientId,
  clientName,
  state,
  dba,
  entityType,
  businessAddress,
}: LegalEntitySearchTabProps) {
  const [savedReport, setSavedReport] = useState<WS110Persistence | null>(null)
  const [flags, setFlags] = useState<WS110Flag[]>([])
  const [loadingReport, setLoadingReport] = useState(true)
  const [activeTab, setActiveTab] = useState<'report' | 'flags'>('report')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const { documents, setDocuments, clearAll, analyze, status, rawMarkdown, error } =
    useWS110Analysis({ clientId, clientName, state, dba, entityType, businessAddress })

  const isRunning = status === 'uploading' || status === 'streaming'

  useEffect(() => {
    setLoadingReport(true)
    fetch(`/api/legal-entity-search/reports?clientId=${clientId}`)
      .then(r => r.json())
      .then(data => {
        if (data.report) {
          setSavedReport(data.report)
          const { flags: pFlags } = parseWS110Markdown(data.report.markdown, clientName)
          const savedStatuses = new Map(((data.report.metadata as any)?.flags ?? []).map((f: any) => [f.id, f.status]))
          setFlags(pFlags.map(f => ({ ...f, status: (savedStatuses.get(f.id) as any) ?? 'pending' })))
        }
      })
      .catch(console.error)
      .finally(() => setLoadingReport(false))
  }, [clientId, clientName])

  useEffect(() => {
    if (status === 'complete' && rawMarkdown) {
      setSavedReport({ markdown: rawMarkdown, createdAt: new Date().toISOString() })
      const { flags: pFlags } = parseWS110Markdown(rawMarkdown, clientName)
      setFlags(pFlags)
      clearAll()
      setToast({ message: 'Legal entity search analysis completed', type: 'success' })
    }
  }, [status, rawMarkdown, clearAll, clientName])

  const handleFlagUpdate = async (id: string, action: 'confirmed' | 'na') => {
    const nextFlags = flags.map(f => (f.id === id ? { ...f, status: action as any } : f))
    setFlags(nextFlags)
    try {
      await fetch(`/api/legal-entity-search/reports?clientId=${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: { flags: nextFlags.map(f => ({ id: f.id, status: f.status })) },
        }),
      })
    } catch {
      setToast({ message: 'Failed to save flag status', type: 'error' })
    }
  }

  const handleNewAnalysis = () => {
    setSavedReport(null)
    setFlags([])
    clearAll()
  }

  const handleDelete = async () => {
    try {
      await fetch(`/api/legal-entity-search/reports?clientId=${clientId}`, { method: 'DELETE' })
      setSavedReport(null)
      setFlags([])
      clearAll()
      setToast({ message: 'Report deleted', type: 'success' })
    } catch {
      setToast({ message: 'Failed to delete report', type: 'error' })
    }
  }

  if (loadingReport) {
    return (
      <div className="h-48 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-stone-200 border-t-amber-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!savedReport && !isRunning) {
    return (
      <div className="-m-6 bg-stone-50 min-h-[500px] p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-10 border-stone-200 shadow-sm">
            <DocumentUploader onDocumentsReady={setDocuments} onAnalyze={analyze} isLoading={isRunning} />
            {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
          </Card>
        </div>
      </div>
    )
  }

  if (isRunning && !savedReport) {
    return (
      <div className="-m-6 bg-stone-50 min-h-[500px] p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-12 border-stone-200 shadow-sm bg-white">
            <div className="flex flex-col items-center gap-8 text-center">
              <div className="w-12 h-12 border-4 border-stone-100 border-t-stone-800 rounded-full animate-spin" />
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-stone-900 tracking-tight">Analyzing legal entity documents...</h3>
                <p className="text-stone-500 max-w-sm mx-auto">
                  Reviewing UCC filings, entity standing, trademarks, and registered agent status. This takes 1-3 minutes.
                </p>
              </div>
              {rawMarkdown.length > 0 && (
                <div className="w-full bg-stone-50 border border-stone-200 rounded-xl p-8 text-left max-h-[450px] overflow-auto shadow-inner">
                  <div className="prose prose-stone prose-sm max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{rawMarkdown}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    )
  }

  const { report } = parseWS110Markdown(savedReport?.markdown || '', clientName)
  const dealRiskCount = flags.filter(f => f.severity === 'deal-risk').length
  const negotiationCount = flags.filter(f => f.severity === 'negotiation').length
  const pendingCount = flags.filter(f => f.status === 'pending').length

  const tabs = [
    { id: 'report' as const, label: 'Full Report' },
    { id: 'flags' as const, label: `Flags (${flags.length})` },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-stone-900 tracking-tight">Legal Reports & Entity Search</h2>
          <p className="text-xs text-stone-500 mt-1">
            Generated {savedReport?.createdAt ? new Date(savedReport.createdAt).toLocaleString() : '—'}
          </p>
          <div className="flex items-center gap-2 mt-2">
            {dealRiskCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                {dealRiskCount} Deal Risk{dealRiskCount !== 1 ? 's' : ''}
              </span>
            )}
            {negotiationCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
                {negotiationCount} Negotiation
              </span>
            )}
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
              {flags.filter(f => f.severity === 'informational').length} Info
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Button variant="outline" size="sm" onClick={handleNewAnalysis}>+ New Analysis</Button>
          <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-600 hover:text-red-700">Delete</Button>
          <ExportReportButton
            html={buildLegalEntitySearchReportHtml(report, flags, clientName)}
            fileName={`legal-entity-search-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
            label="Export PDF"
          />
        </div>
      </div>

      {pendingCount > 0 && flags.length > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <p className="text-sm text-amber-800">
            {pendingCount} of {flags.length} flags pending review.
          </p>
        </div>
      )}

      <Card className="overflow-hidden border-stone-200 shadow-sm bg-white">
        <div className="flex border-b border-stone-100 bg-stone-50/50 px-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-5 py-4 text-[12px] font-medium tracking-tight transition-all relative',
                activeTab === tab.id ? 'text-stone-900' : 'text-stone-400 hover:text-stone-600'
              )}
            >
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-stone-800" />}
            </button>
          ))}
        </div>

        <div className="min-h-[500px] p-6">
          {activeTab === 'report' && savedReport?.markdown && (
            <div className="prose prose-stone prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{savedReport.markdown}</ReactMarkdown>
            </div>
          )}
          {activeTab === 'flags' && (
            <FlagReviewPanel
              flags={flags}
              onConfirm={id => handleFlagUpdate(id, 'confirmed')}
              onNA={id => handleFlagUpdate(id, 'na')}
            />
          )}
        </div>
      </Card>

      {toast && (
        <div className={cn(
          'fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3',
          toast.type === 'success' ? 'bg-stone-900 text-white border-stone-800' : 'bg-red-50 text-red-700 border-red-200'
        )}>
          <div className={cn('w-2 h-2 rounded-full', toast.type === 'success' ? 'bg-amber-400' : 'bg-red-500')} />
          <p className="text-[14px] font-medium">{toast.message}</p>
          <button onClick={() => setToast(null)} className="ml-4 opacity-50 hover:opacity-100">×</button>
        </div>
      )}
    </div>
  )
}
