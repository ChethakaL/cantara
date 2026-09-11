'use client'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { Plus, X, Trash2 } from 'lucide-react'
import { Button, Card, Modal } from '@/components/ui'
import type { ContractAnalysis, DocumentStatus } from '@/lib/store'
import { deleteContractAnalysis, getContractAnalyses, saveContractAnalysis, updateContractAnalysis } from '@/lib/store'
import { useContractAnalysis } from '@/hooks/useContractAnalysis'
import { parseReport } from '@/lib/contract-analysis/parse-report'
import type { ContractReport as ContractReportData } from '@/lib/contract-analysis/types'
import { ContractUploader } from '../contract-analysis/ContractUploader'
import { AnalysisProgress } from '../contract-analysis/AnalysisProgress'
import { ContractReport } from '../contract-analysis/ContractReport'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import type { AgentTabReadOnlyProps } from '@/types/agent-tab'
import { AgentRunToolbar } from '@/components/admin/AgentRunToolbar'
import type { AgentRunHistoryItem } from '@/components/admin/AgentRunHistoryPanel'
import { formatAgentProviderLabel } from '@/lib/agent-model-provider'
import {
  fetchClientDocumentFile,
  listClientDocuments,
  type ClientUploadedDoc,
} from '@/lib/client-documents-client'

const MATERIAL_CONTRACTS_DOCUMENT_ID = 'material_contracts'

interface Props extends AgentTabReadOnlyProps {
  clientId: string
  clientName: string
  documentStatuses?: Record<string, any>
  onRefreshDocuments?: () => void | Promise<void>
}

export default function ContractAnalysisTab({
  clientId,
  clientName,
  documentStatuses,
  onRefreshDocuments,
  readOnly = false,
}: Props) {
  const [analyses, setAnalyses] = useState<ContractAnalysis[]>([])
  const [activeAnalysis, setActiveAnalysis] = useState<ContractAnalysis | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [composingNew, setComposingNew] = useState(false)
  const [uploadedFromDocuments, setUploadedFromDocuments] = useState<ClientUploadedDoc[]>([])
  const [loadingUploadedId, setLoadingUploadedId] = useState<string | null>(null)

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
  } = useContractAnalysis(clientId)

  const loadUploadedContracts = useCallback(async () => {
    try {
      const docs = await listClientDocuments(clientId, [MATERIAL_CONTRACTS_DOCUMENT_ID])
      setUploadedFromDocuments(docs)
    } catch {
      /* ignore */
    }
  }, [clientId])

  const handleRefreshDocuments = useCallback(async () => {
    await loadUploadedContracts()
    if (onRefreshDocuments) await onRefreshDocuments()
  }, [loadUploadedContracts, onRefreshDocuments])

  useEffect(() => {
    void loadUploadedContracts()
  }, [loadUploadedContracts])

  const handleUseUploadedDocument = useCallback(async (doc: ClientUploadedDoc) => {
    setLoadingUploadedId(doc.id)
    try {
      const file = await fetchClientDocumentFile({
        clientId,
        documentId: doc.documentId,
        recordId: doc.id,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
      })
      await addDocuments([file])
      setComposingNew(true)
    } catch (err) {
      console.error('Failed to load material contract from Documents:', err)
    } finally {
      setLoadingUploadedId(null)
    }
  }, [addDocuments, clientId])

  const loadAnalyses = useCallback(async () => {
    const data = await getContractAnalyses(clientId)
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
      await deleteContractAnalysis(id)
      const updated = await loadAnalyses()
      setActiveAnalysis(updated[0] ?? null)
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const handleReportUpdated = useCallback(async (nextReport: ContractReportData) => {
    if (!activeAnalysis?.id) return

    const updated = await updateContractAnalysis(activeAnalysis.id, {
      report: nextReport.raw,
      parsed: nextReport,
    })

    setActiveAnalysis(updated)
    setAnalyses((current) => current.map((analysis) => (
      analysis.id === updated.id ? updated : analysis
    )))
  }, [activeAnalysis])

  useEffect(() => {
    loadAnalyses().then((data) => {
      if (data.length > 0) setActiveAnalysis(current => current ?? data[0])
      setInitialLoadDone(true)
    })
  }, [loadAnalyses])

  useEffect(() => {
    if (status === 'complete' && streamedReport) {
      const allNames = uploads.map((doc) => doc.name).join(', ')

      saveContractAnalysis({
        clientId,
        fileName: allNames,
        report: rawMarkdown,
        parsed: streamedReport,
        aiProvider: provider,
        aiModel: lastModelId ?? undefined,
      }).then((saved) => {
        if (saved?.id) setActiveAnalysis(saved)
        setComposingNew(false)
        loadAnalyses()
        clearAll()
      })
    }
  }, [status, streamedReport, clientId, rawMarkdown, uploads, loadAnalyses, clearAll, provider, lastModelId])

  const displayReport = (status === 'streaming' || status === 'complete') && streamedReport
    ? streamedReport
    : activeAnalysis?.report
      ? parseReport(activeAnalysis.report)
      : activeAnalysis?.parsed

  const displayFileName = status === 'streaming' || status === 'complete'
    ? uploads.map((doc) => doc.name).join(', ')
    : activeAnalysis?.fileName || ''

  const historyItems: AgentRunHistoryItem[] = useMemo(() => {
    return analyses.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      createdAt: typeof a.createdAt === 'string' ? a.createdAt : new Date(a.createdAt).toISOString(),
      aiProvider: a.aiProvider,
      aiModel: a.aiModel,
    }))
  }, [analyses])

  const hasExistingReport = Boolean(displayReport) || analyses.length > 0
  const showUploader = !readOnly && status === 'idle' && (
    composingNew || !hasExistingReport
  )
  const showReport = Boolean(displayReport) && !composingNew

  const readOnlyGate = agentTabReadOnlyGate(readOnly, !initialLoadDone, showReport, 'Material Contracts')
  if (readOnlyGate) return readOnlyGate

  return (
    <div className="space-y-6">
      {!readOnly && (
        <AgentRunToolbar
          provider={provider}
          onProviderChange={setProvider}
          disabled={status !== 'idle' || deleting}
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

      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="font-serif text-xl font-bold text-slate-900 tracking-tight">
            {showReport
              ? 'Material Contracts Analysis Report'
              : composingNew
                ? 'New Contract Analysis'
                : 'Material Contracts Analysis'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {showReport
              ? `Vendor, supplier, software, and commercial customer agreements review for ${clientName}`
              : `Upload business contracts to evaluate saleability, counterparty restrictions, and buyer risk for ${clientName}`}
          </p>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2 shrink-0">
            {showReport && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-8 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200"
                  onClick={beginNewAnalysis}
                  data-advisor-action
                >
                  <Plus className="w-3.5 h-3.5 text-slate-500" /> New Analysis
                </Button>
                {activeAnalysis && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-slate-200"
                    onClick={() => setDeleteOpen(true)}
                    data-advisor-action
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                )}
              </>
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

      <div className="space-y-6">
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
            <ContractUploader
              clientId={clientId}
              documents={uploads}
              addDocuments={addDocuments}
              removeDocument={removeDocument}
              status={status}
              onAnalyze={analyze}
              uploadedFromDocuments={uploadedFromDocuments}
              documentStatus={documentStatuses?.[MATERIAL_CONTRACTS_DOCUMENT_ID]}
              onRefreshDocuments={handleRefreshDocuments}
              onUseUploadedDocument={handleUseUploadedDocument}
              loadingUploadedId={loadingUploadedId}
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

        {showReport && (
          <ContractReport
            report={displayReport!}
            fileName={displayFileName}
            clientName={clientName}
            onNewAnalysis={beginNewAnalysis}
            onDelete={!readOnly && activeAnalysis ? () => setDeleteOpen(true) : undefined}
            adminMode={!readOnly}
            onReportUpdated={!readOnly ? handleReportUpdated : undefined}
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
            This will permanently delete the saved contract analysis report.
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
