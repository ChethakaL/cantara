'use client'
import { useState, useCallback, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Button, Card, Modal } from '@/components/ui'
import type { LeaseAnalysis } from '@/lib/store'
import { saveLeaseAnalysis, getLeaseAnalyses, deleteLeaseAnalysis, updateLeaseAnalysis } from '@/lib/store'
import { useLeaseAnalysis } from '@/hooks/useLeaseAnalysis'
import type { LeaseReport as LeaseReportData } from '@/lib/lease-analysis/types'

// Modular components
import { LeaseUploader } from '../lease-analysis/LeaseUploader'
import { AnalysisProgress } from '../lease-analysis/AnalysisProgress'
import { LeaseReport } from '../lease-analysis/LeaseReport'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import type { AgentTabReadOnlyProps } from '@/types/agent-tab'
import { AgentRunHistoryPanel } from '@/components/admin/AgentRunHistoryPanel'
import { formatAgentProviderLabel } from '@/lib/agent-model-provider'

interface Props extends AgentTabReadOnlyProps {
  clientId: string
  clientName: string
}

export default function LeaseAnalysisTab({ clientId, clientName, readOnly = false }: Props) {
  const [analyses, setAnalyses] = useState<LeaseAnalysis[]>([])
  const [activeAnalysis, setActiveAnalysis] = useState<LeaseAnalysis | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [composingNew, setComposingNew] = useState(false)
  const { 
    documents: uploads, 
    addDocuments, 
    removeDocument,
    analyze, 
    status, 
    rawMarkdown, 
    report: streamedReport, 
    error: analysisError,
    clearAll,
    provider,
    setProvider,
    lastModelId,
  } = useLeaseAnalysis(clientId)

  const loadAnalyses = useCallback(async () => {
    const data = await getLeaseAnalyses(clientId)
    setAnalyses(data)
    return data
  }, [clientId])

  const beginNewAnalysis = useCallback(() => {
    clearAll()
    setComposingNew(true)
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
      if (data.length > 0) setActiveAnalysis(current => current ?? data[0])
      setInitialLoadDone(true)
    })
  }, [loadAnalyses])

  // Save report when complete
  useEffect(() => {
    if (status === 'complete' && streamedReport) {
      const allNames = uploads.map(d => d.name).join(', ')
      
      saveLeaseAnalysis({
        clientId,
        fileName: allNames,
        report: rawMarkdown,
        parsed: streamedReport,
        aiProvider: provider,
        aiModel: lastModelId ?? undefined,
      }).then((saved) => {
        // Use DB-generated ID so deletes work on first click.
        if (saved?.id) setActiveAnalysis(saved)
        setComposingNew(false)
        loadAnalyses()
        clearAll()
      })
    }
  }, [status, streamedReport, clientId, rawMarkdown, uploads, loadAnalyses, clearAll, provider, lastModelId])

  // Use either the historical active analysis or the live streamed one
  const displayReport = (status === 'streaming' || status === 'complete') && streamedReport 
    ? streamedReport 
    : activeAnalysis?.parsed

  const displayFileName = status === 'streaming' || status === 'complete'
    ? uploads.map(d => d.name).join(', ')
    : activeAnalysis?.fileName || ''

  const showUploader = !readOnly && status === 'idle' && (composingNew || analyses.length === 0 || uploads.length > 0)
  const showReport = Boolean(displayReport) && !composingNew

  const readOnlyGate = agentTabReadOnlyGate(readOnly, !initialLoadDone, showReport, 'Lease Analysis')
  if (readOnlyGate) return readOnlyGate

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 cantara-serif">Lease Analysis</h3>
          <p className="text-xs text-slate-400 mt-0.5">Upload lease PDFs to run full M&A due diligence analysis</p>
          <p className="text-xs text-slate-400 mt-1">Lease documents can also be uploaded in the Documents tab.</p>
          {activeAnalysis?.aiProvider && !composingNew && (
            <p className="text-xs text-slate-500 mt-1">
              Viewing run: {formatAgentProviderLabel(activeAnalysis.aiProvider)}
              {activeAnalysis.aiModel ? ` · ${activeAnalysis.aiModel}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <AgentRunHistoryPanel
            runs={analyses}
            activeId={activeAnalysis?.id}
            onSelect={(run) => {
              const found = analyses.find((analysis) => analysis.id === run.id)
              if (found) {
                setComposingNew(false)
                setActiveAnalysis(found)
              }
            }}
          />
        {analyses.length > 0 && !composingNew && (
          <Button variant="outline" size="sm" className="gap-2" onClick={beginNewAnalysis} data-advisor-action>
            <Plus className="w-3.5 h-3.5" /> New Analysis
          </Button>
        )}
        </div>
      </div>

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
                <Button variant="outline" size="sm" onClick={beginNewAnalysis}>Try Again</Button>
              </div>
            ) : null}
          </Card>
        ) : showUploader ? (
          <div data-advisor-action>
          <LeaseUploader 
            documents={uploads}
            addDocuments={addDocuments}
            removeDocument={removeDocument}
            status={status}
            onAnalyze={analyze}
            provider={provider}
            onProviderChange={setProvider}
          />
          </div>
        ) : null}

        {/* Report Display */}
        {showReport && (
          <LeaseReport 
            report={displayReport!}
            fileName={displayFileName}
            clientName={clientName}
            onNewAnalysis={beginNewAnalysis}
            onDelete={activeAnalysis ? () => setDeleteOpen(true) : undefined}
            onReportUpdated={!readOnly && activeAnalysis && status === 'idle' ? handleReportUpdated : undefined}
            adminMode={!readOnly && Boolean(activeAnalysis && status === 'idle')}
            hideNewAnalysis
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
