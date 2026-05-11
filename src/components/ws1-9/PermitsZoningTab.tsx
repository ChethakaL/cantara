'use client'

import React, { useState, useEffect } from 'react'
import { Card, Button, cn } from '@/components/ui'
import { useWS19Analysis } from '@/hooks/useWS19Analysis'
import WS19Uploader from './WS19Uploader'
import ReportHeader from './ReportHeader'
import {
  SummaryTab,
  DocumentsTab,
  PermitsTab,
  ZoningTab,
  ConditionalUseTab,
  GrandfatheringTab,
  AdminReviewTab,
} from './TabPanels'
import { WS19Persistence, WS19Report, WS19Flag } from '@/types/ws1-9-types'
import { parseWS19Markdown } from '@/lib/ws1-9/parser'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ExportReportButton } from '@/components/report-export/ExportReportButton'
import { buildPermitsZoningReportHtml } from '@/lib/report-export/build-permits-zoning-report'

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM UI COMPONENTS: Modal & Toast
// ─────────────────────────────────────────────────────────────────────────────

function DeleteConfirmModal({ isOpen, onClose, onConfirm, isDeleting }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void; isDeleting: boolean
}) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
        <div className="p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center text-2xl font-serif">
            !
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-semibold text-stone-900 tracking-tight">Delete Analysis Report</h3>
            <p className="text-stone-500 text-[14px]">
              This will permanently remove the AI analysis for this client. You will need to re-upload documents to recreate it.
            </p>
          </div>
        </div>
        <div className="flex border-t border-stone-100 p-4 gap-3 bg-stone-50/50">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1 rounded-xl bg-red-600 text-white border-none hover:bg-red-700" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusToast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={cn(
      "fixed bottom-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-right-10 duration-500",
      type === 'success' ? "bg-stone-900 text-white border-stone-800" : "bg-red-50 text-red-700 border-red-200"
    )}>
      <div className={cn("w-2 h-2 rounded-full", type === 'success' ? "bg-amber-400 animate-pulse" : "bg-red-500")} />
      <p className="text-[14px] font-medium tracking-tight">{message}</p>
      <button onClick={onClose} className="ml-4 opacity-50 hover:opacity-100 transition-opacity">x</button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface PermitsZoningTabProps {
  clientId: string
  clientName: string
  state?: string
  dba?: string
  propertyAddress?: string
  municipality?: string
}

type ReviewMetadata = {
  flags?: Array<{ id: string; status: WS19Flag['status'] }>
  releasedAt?: string | null
  downstream?: Record<string, unknown>
}

export default function PermitsZoningTab({
  clientId,
  clientName,
  state,
  dba,
  propertyAddress,
  municipality,
}: PermitsZoningTabProps) {
  const [savedReport, setSavedReport] = useState<WS19Persistence | null>(null)
  const [flags, setFlags] = useState<WS19Flag[]>([])
  const [loadingReport, setLoadingReport] = useState(true)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState('summary')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [releasing, setReleasing] = useState(false)

  const { documents, setDocuments, clearAll, analyze, status, rawMarkdown, error } =
    useWS19Analysis({ clientId, clientName, state, dba, propertyAddress, municipality })

  const mergeFlagStatuses = (parsedFlags: WS19Flag[], metadata?: ReviewMetadata) => {
    const savedStatuses = new Map((metadata?.flags ?? []).map(flag => [flag.id, flag.status]))
    return parsedFlags.map(flag => ({
      ...flag,
      status: savedStatuses.get(flag.id) ?? 'pending',
    }))
  }

  const isRunning = status === 'uploading' || status === 'streaming'

  const showToast = (message: string, type: 'success' | 'error' = 'success') => setToast({ message, type })

  useEffect(() => {
    setLoadingReport(true)
    fetch(`/api/permits-zoning/reports?clientId=${clientId}`)
      .then(r => r.json())
      .then(data => {
        if (data.report) {
          setSavedReport(data.report)
          const { flags: pFlags } = parseWS19Markdown(data.report.markdown, clientName)
          setFlags(mergeFlagStatuses(pFlags || [], data.report.metadata))
        }
      })
      .catch(console.error)
      .finally(() => setLoadingReport(false))
  }, [clientId, clientName])

  useEffect(() => {
    if (status === 'complete' && rawMarkdown) {
      setSavedReport({ markdown: rawMarkdown, createdAt: new Date().toISOString() })
      const { flags: pFlags } = parseWS19Markdown(rawMarkdown, clientName)
      setFlags(mergeFlagStatuses(pFlags || []))
      clearAll()
      showToast('Analysis completed successfully')
    }
  }, [status, rawMarkdown, clearAll, clientName])

  const { report: extractedReport } = parseWS19Markdown(
    savedReport?.markdown || '',
    clientName
  )

  const report: WS19Report = {
    clientName,
    generatedAt: savedReport?.createdAt ?? new Date().toISOString(),
    hitlStatus: (flags.filter(f => f.status !== 'pending').length === flags.length ? 'complete' : 'in-progress') as any,
    documents: extractedReport.documents || [],
    permits: extractedReport.permits || [],
    zoning: extractedReport.zoning || [],
    conditionalUsePermits: extractedReport.conditionalUsePermits || [],
    grandfathering: extractedReport.grandfathering || [],
    buyerSummary: extractedReport.buyerSummary || {
      permitsOverview: 'No summary available.',
      zoningCompliance: '',
      conditionalUseStatus: '',
      grandfatheringRisk: '',
      transferConsiderations: '',
      counselItems: [],
    },
  }

  const persistReviewState = async (nextFlags: WS19Flag[], releasedAt?: string | null) => {
    const markdown = savedReport?.markdown
    if (!markdown) return

    const metadata: ReviewMetadata = {
      flags: nextFlags.map(flag => ({ id: flag.id, status: flag.status })),
      releasedAt: releasedAt ?? null,
    }

    const response = await fetch(`/api/permits-zoning/reports?clientId=${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata }),
    })

    if (!response.ok) {
      throw new Error(await response.text().catch(() => 'Failed to save review state'))
    }

    const data = await response.json()
    if (data.report) setSavedReport(data.report)
  }

  const handleFlagUpdate = async (id: string, action: 'confirmed' | 'na') => {
    const nextFlags = flags.map(flag => (flag.id === id ? { ...flag, status: action } : flag))
    setFlags(nextFlags)
    try {
      await persistReviewState(nextFlags, (savedReport as any)?.metadata?.releasedAt ?? null)
    } catch (err) {
      console.error('Failed to persist review state:', err)
      showToast('Failed to save review status.', 'error')
    }
  }

  const handleRelease = async () => {
    setReleasing(true)
    try {
      const releasedAt = new Date().toISOString()
      await persistReviewState(flags, releasedAt)
      showToast('Review state released for downstream use')
    } catch (err) {
      console.error('Release failed:', err)
      showToast('Failed to release review state.', 'error')
    } finally {
      setReleasing(false)
    }
  }

  const handleNewAnalysis = () => {
    setSavedReport(null)
    setFlags([])
    clearAll()
    showToast('Starting new analysis session')
  }

  const handleDeleteConfirmed = async () => {
    setDeleting(true)
    try {
      const resp = await fetch(`/api/permits-zoning/reports?clientId=${clientId}`, {
        method: 'DELETE',
      })
      if (!resp.ok) throw new Error('Delete failed')

      setSavedReport(null)
      setFlags([])
      clearAll()
      setDeleteOpen(false)
      showToast('Report deleted successfully')
    } catch (err) {
      console.error('Delete failed:', err)
      showToast('Failed to delete report. Please try again.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (!savedReport && !isRunning) {
    return (
      <div className="-m-6 bg-stone-50 min-h-[500px] p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-10 border-stone-200 shadow-sm">
            <WS19Uploader clientId={clientId} onDocumentsReady={setDocuments} onAnalyze={analyze} isLoading={isRunning} />
            {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
          </Card>
        </div>
        {toast && <StatusToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
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
                <h3 className="text-xl font-semibold text-stone-900 tracking-tight">Analyzing permits & zoning...</h3>
                <p className="text-stone-500 max-w-sm mx-auto">
                  Feeding documents to engine. This takes 1-2 minutes for large sets.
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
        {toast && <StatusToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    )
  }

  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'documents', label: 'Documents' },
    { id: 'permits', label: 'Permits' },
    { id: 'zoning', label: 'Zoning' },
    { id: 'conditionaluse', label: 'Conditional Use' },
    { id: 'grandfathering', label: 'Grandfathering' },
    { id: 'review', label: 'Admin Review' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <ReportHeader report={report} flags={flags} onDelete={() => setDeleteOpen(true)} onNewAnalysis={handleNewAnalysis} />
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <ExportReportButton
            html={buildPermitsZoningReportHtml(report, flags, clientName)}
            fileName={`permits-zoning-${clientName.replace(/\s+/g, '-').toLowerCase()}`}
            label="Export Permits & Zoning Report"
          />
        </div>
      </div>

      {/* Workflow guidance banner */}
      {(() => {
        const pendingCount = flags.filter(f => f.status === 'pending').length
        const totalCount = flags.length
        const allDone = totalCount > 0 && pendingCount === 0
        return allDone ? (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="text-emerald-600 text-sm">OK</span>
            <p className="text-sm text-emerald-800">
              All {totalCount} flags reviewed -- report is ready for export. Use <strong>"+ New Analysis"</strong> to re-run with updated documents.
            </p>
          </div>
        ) : totalCount > 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <span className="text-amber-600 text-sm">!</span>
            <p className="text-sm text-amber-800">
              Review in progress -- {pendingCount} of {totalCount} flags remaining. Use <strong>"+ New Analysis"</strong> to re-run with updated documents.
            </p>
          </div>
        ) : null
      })()}

      <Card className="overflow-hidden border-stone-200 shadow-sm bg-white ring-1 ring-stone-950/5">
        <div className="flex border-b border-stone-100 bg-stone-50/50 px-4 overflow-x-auto whitespace-nowrap scrollbar-hide">
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

        <div className="min-h-[500px]">
          {activeTab === 'summary' && <SummaryTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} />}
          {activeTab === 'documents' && <DocumentsTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} />}
          {activeTab === 'permits' && <PermitsTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} />}
          {activeTab === 'zoning' && <ZoningTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} />}
          {activeTab === 'conditionaluse' && <ConditionalUseTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} />}
          {activeTab === 'grandfathering' && <GrandfatheringTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} />}
          {activeTab === 'review' && <AdminReviewTab report={report} flags={flags} onConfirm={id => handleFlagUpdate(id, 'confirmed')} onNA={id => handleFlagUpdate(id, 'na')} onRelease={handleRelease} isReleasing={releasing} />}
        </div>
      </Card>

      <DeleteConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirmed}
        isDeleting={deleting}
      />
      {toast && <StatusToast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
