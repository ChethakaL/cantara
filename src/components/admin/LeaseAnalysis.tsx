'use client'
import { useState, useCallback, useEffect } from 'react'
import { FileText, Plus } from 'lucide-react'
import { Button, Card, Modal } from '@/components/ui'
import type { LeaseAnalysis } from '@/lib/store'
import { saveLeaseAnalysis, getLeaseAnalyses, deleteLeaseAnalysis, updateLeaseAnalysis } from '@/lib/store'
import { useLeaseAnalysis } from '@/hooks/useLeaseAnalysis'
import type { LeaseReport as LeaseReportData } from '@/lib/lease-analysis/types'

// Modular components
import { LeaseUploader } from '../lease-analysis/LeaseUploader'
import { AnalysisProgress } from '../lease-analysis/AnalysisProgress'
import { LeaseReport } from '../lease-analysis/LeaseReport'

interface Props {
  clientId: string
  clientName: string
}

export default function LeaseAnalysisTab({ clientId, clientName }: Props) {
  const [analyses, setAnalyses] = useState<LeaseAnalysis[]>([])
  const [activeAnalysis, setActiveAnalysis] = useState<LeaseAnalysis | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  const { 
    documents: uploads, 
    addDocuments, 
    removeDocument,
    analyze, 
    status, 
    rawMarkdown, 
    report: streamedReport, 
    error: analysisError,
    clearAll
  } = useLeaseAnalysis(clientId)

  const loadAnalyses = useCallback(async () => {
    const data = await getLeaseAnalyses(clientId)
    setAnalyses(data)
    return data
  }, [clientId])

  const beginNewAnalysis = useCallback(() => {
    clearAll()
    setActiveAnalysis(null)
  }, [clearAll])

  const handleDeleteConfirmed = async () => {
    const id = activeAnalysis?.id
    if (!id) return
    setDeleting(true)
    try {
      await deleteLeaseAnalysis(id)
      const updated = await loadAnalyses()
      setActiveAnalysis(updated[0] ?? null)
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const handleReportUpdated = useCallback(async (nextReport: LeaseReportData) => {
    if (!activeAnalysis?.id) return

    const updated = await updateLeaseAnalysis(activeAnalysis.id, {
      report: nextReport.raw,
      parsed: nextReport,
    })

    setActiveAnalysis(updated)
    setAnalyses((current) => current.map((analysis) => (
      analysis.id === updated.id ? updated : analysis
    )))
  }, [activeAnalysis])

  useEffect(() => {
    loadAnalyses().then(data => {
        if (data.length > 0 && !activeAnalysis) setActiveAnalysis(data[0])
    })
  }, [loadAnalyses, activeAnalysis])

  // Save report when complete
  useEffect(() => {
    if (status === 'complete' && streamedReport) {
      const allNames = uploads.map(d => d.name).join(', ')
      
      saveLeaseAnalysis({
        clientId,
        fileName: allNames,
        report: rawMarkdown,
        parsed: streamedReport,
      }).then((saved) => {
        // Use DB-generated ID so deletes work on first click.
        if (saved?.id) setActiveAnalysis(saved)
        loadAnalyses()
        clearAll()
      })
    }
  }, [status, streamedReport, clientId, rawMarkdown, uploads, loadAnalyses, clearAll])

  // Use either the historical active analysis or the live streamed one
  const displayReport = (status === 'streaming' || status === 'complete') && streamedReport 
    ? streamedReport 
    : activeAnalysis?.parsed

  const displayFileName = status === 'streaming' || status === 'complete'
    ? uploads.map(d => d.name).join(', ')
    : activeAnalysis?.fileName || ''

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 cantara-serif">Lease Analysis</h3>
          <p className="text-xs text-slate-400 mt-0.5">Upload lease PDFs to run full M&A due diligence analysis</p>
        </div>
        {analyses.length > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={beginNewAnalysis}>
            <Plus className="w-3.5 h-3.5" /> New Analysis
          </Button>
        )}
      </div>

      {/* Prior analyses selector */}
      {analyses.length > 1 && status === 'idle' && (
        <div className="flex gap-2 flex-wrap">
          {analyses.map(a => (
            <button
              key={a.id}
              onClick={() => setActiveAnalysis(a)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                activeAnalysis?.id === a.id ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <FileText className="w-3 h-3 inline mr-1.5" />
              {a.fileName.length > 30 ? a.fileName.slice(0, 30) + '…' : a.fileName}
              <span className="ml-2 text-slate-400">{new Date(a.createdAt).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Content Area */}
      <div className="space-y-6">
        {/* Upload & Progress */}
        {status !== 'idle' ? (
          <Card className="p-8">
            {status === 'streaming' || status === 'uploading' ? (
              <AnalysisProgress status={status} rawMarkdown={rawMarkdown} />
            ) : analysisError ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-rose-500 font-medium">{analysisError}</p>
                <Button variant="outline" size="sm" onClick={clearAll}>Try Again</Button>
              </div>
            ) : null}
          </Card>
        ) : analyses.length === 0 || uploads.length > 0 ? (
          <LeaseUploader 
            documents={uploads}
            addDocuments={addDocuments}
            removeDocument={removeDocument}
            status={status}
            onAnalyze={analyze}
          />
        ) : null}

        {/* Report Display */}
        {displayReport && (
          <LeaseReport 
            report={displayReport}
            fileName={displayFileName}
            clientName={clientName}
            onNewAnalysis={beginNewAnalysis}
            onDelete={activeAnalysis ? () => setDeleteOpen(true) : undefined}
            onReportUpdated={activeAnalysis && status === 'idle' ? handleReportUpdated : undefined}
            adminMode={Boolean(activeAnalysis && status === 'idle')}
          />
        )}
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => (deleting ? null : setDeleteOpen(false))}
        title="Delete this analysis?"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This will permanently delete the saved lease analysis report.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={deleting} onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" disabled={deleting} onClick={handleDeleteConfirmed}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
