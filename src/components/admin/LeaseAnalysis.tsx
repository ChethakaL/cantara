'use client'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { Plus, X } from 'lucide-react'
import { Button, Card, Modal } from '@/components/ui'
import type { LeaseAnalysis, DocumentStatus } from '@/lib/store'
import { saveLeaseAnalysis, getLeaseAnalyses, deleteLeaseAnalysis, updateLeaseAnalysis } from '@/lib/store'
import { useLeaseAnalysis } from '@/hooks/useLeaseAnalysis'
import type { LeaseReport as LeaseReportData, LeaseDocument } from '@/lib/lease-analysis/types'
import { convertPdfToBase64 } from '@/lib/lease-analysis/pdf-to-base64'

// Modular components
import { LeaseUploader } from '../lease-analysis/LeaseUploader'
import { AnalysisProgress } from '../lease-analysis/AnalysisProgress'
import { LeaseReport } from '../lease-analysis/LeaseReport'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import type { AgentTabReadOnlyProps } from '@/types/agent-tab'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'
import {
  fetchClientDocumentFile,
  listClientDocuments,
  type ClientUploadedDoc,
} from '@/lib/client-documents-client'

const LEASES_DOCUMENT_ID = 'leases'

interface Props extends AgentTabReadOnlyProps {
  clientId: string
  clientName: string
  documentStatuses?: Record<string, DocumentStatus>
}

export default function LeaseAnalysisTab({ clientId, clientName, documentStatuses, readOnly = false }: Props) {
  const [analyses, setAnalyses] = useState<LeaseAnalysis[]>([])
  const [activeAnalysis, setActiveAnalysis] = useState<LeaseAnalysis | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [composingNew, setComposingNew] = useState(false)
  const [uploadedFromDocuments, setUploadedFromDocuments] = useState<ClientUploadedDoc[]>([])
  const [loadingPortalDocs, setLoadingPortalDocs] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
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

  const loadUploadedLeases = useCallback(async () => {
    setLoadingPortalDocs(true)
    try {
      setUploadedFromDocuments(await listClientDocuments(clientId, [LEASES_DOCUMENT_ID]))
    } catch {
      /* ignore */
    } finally {
      setLoadingPortalDocs(false)
    }
  }, [clientId])

  useEffect(() => {
    void loadUploadedLeases()
  }, [loadUploadedLeases])

  const handleAnalyze = useCallback(async () => {
    setIsPreparing(true)
    try {
      const missingPortalDocs = uploadedFromDocuments.filter(
        (pDoc) => !uploads.some((u) => u.name === pDoc.fileName),
      )

      let allDocs: LeaseDocument[] = [...uploads]

      if (missingPortalDocs.length > 0) {
        for (const pDoc of missingPortalDocs) {
          try {
            const file = await fetchClientDocumentFile({
              clientId,
              documentId: pDoc.documentId,
              recordId: pDoc.id,
              fileName: pDoc.fileName,
              mimeType: pDoc.mimeType,
            })
            const base64 = await convertPdfToBase64(file)
            allDocs.push({
              name: file.name,
              base64,
              mediaType: 'application/pdf',
              sizeBytes: file.size,
            })
          } catch (fetchErr) {
            console.error(`Failed to fetch portal doc ${pDoc.fileName}:`, fetchErr)
          }
        }
      }

      if (allDocs.length === 0) {
        return
      }

      await analyze(allDocs)
    } finally {
      setIsPreparing(false)
    }
  }, [analyze, clientId, uploadedFromDocuments, uploads])

  const historyItems = useMemo<AgentRunHistoryItem[]>(
    () =>
      analyses.map((a, idx) => ({
        id: a.id,
        createdAt: a.createdAt,
        fileName: a.fileName,
        aiProvider: a.aiProvider ?? undefined,
        aiModel: a.aiModel ?? undefined,
        version: analyses.length - idx,
      })),
    [analyses],
  )

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

  const hasExistingReport = Boolean(displayReport) || analyses.length > 0
  const showUploader = !readOnly && status === 'idle' && (
    composingNew || !hasExistingReport
  )
  const showReport = Boolean(displayReport) && !composingNew

  const readOnlyGate = agentTabReadOnlyGate(readOnly, !initialLoadDone, showReport, 'Lease Analysis')
  if (readOnlyGate) return readOnlyGate

  return (
    <div className="space-y-6">
      {!readOnly && (
        <AgentRunToolbar
          provider={provider}
          onProviderChange={setProvider}
          disabled={status !== 'idle' || isPreparing || deleting}
          historyItems={historyItems}
          activeId={activeAnalysis?.id}
          onSelectRun={(run) => {
            const found = analyses.find((analysis) => analysis.id === run.id)
            if (found) {
              setComposingNew(false)
              setActiveAnalysis(found)
            }
          }}
          activeProvider={activeAnalysis?.aiProvider}
          activeModel={activeAnalysis?.aiModel}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            {showReport
              ? 'Commercial Lease Analysis Report'
              : composingNew
                ? 'New Lease Analysis'
                : 'Commercial Lease Analysis'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {showReport
              ? `Commercial lease due diligence, rent escalations, options & financial risks for ${clientName}`
              : `Review and analyze commercial lease agreements and addendums for ${clientName}`}
          </p>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2 shrink-0">
            {showReport && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200"
                onClick={beginNewAnalysis}
                data-advisor-action
              >
                <Plus className="w-3.5 h-3.5 text-slate-500" /> New Analysis
              </Button>
            )}
            {analyses.length > 0 && composingNew && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium text-slate-700"
                onClick={() => {
                  clearAll()
                  setComposingNew(false)
                  if (!activeAnalysis && analyses.length > 0) {
                    setActiveAnalysis(analyses[0])
                  }
                }}
                data-advisor-action
              >
                <X className="w-3.5 h-3.5 mr-1 text-slate-500" /> Cancel
              </Button>
            )}
          </div>
        )}
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
              clientId={clientId}
              documents={uploads}
              addDocuments={addDocuments}
              removeDocument={removeDocument}
              status={status}
              onAnalyze={handleAnalyze}
              uploadedFromDocuments={uploadedFromDocuments}
              documentStatus={documentStatuses?.['leases']}
              onRefreshDocuments={loadUploadedLeases}
              loadingPortalDocs={loadingPortalDocs}
              isPreparing={isPreparing}
              onCancel={analyses.length > 0 && composingNew ? () => {
                clearAll()
                setComposingNew(false)
                if (!activeAnalysis && analyses.length > 0) {
                  setActiveAnalysis(analyses[0])
                }
              } : undefined}
              error={analysisError}
              readOnly={readOnly}
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
