'use client'
import { useState, useCallback, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Button, Card, Modal } from '@/components/ui'
import type { ContractAnalysis } from '@/lib/store'
import { deleteContractAnalysis, getContractAnalyses, saveContractAnalysis, updateContractAnalysis } from '@/lib/store'
import { useContractAnalysis } from '@/hooks/useContractAnalysis'
import { parseReport } from '@/lib/contract-analysis/parse-report'
import type { ContractReport as ContractReportData } from '@/lib/contract-analysis/types'
import { ContractUploader } from '../contract-analysis/ContractUploader'
import { AnalysisProgress } from '../contract-analysis/AnalysisProgress'
import { ContractReport } from '../contract-analysis/ContractReport'
import { agentTabReadOnlyGate } from '@/hooks/useAgentTabReadOnly'
import type { AgentTabReadOnlyProps } from '@/types/agent-tab'
import { AgentRunHistoryPanel } from '@/components/admin/AgentRunHistoryPanel'
import { formatAgentProviderLabel } from '@/lib/agent-model-provider'

interface Props extends AgentTabReadOnlyProps {
  clientId: string
  clientName: string
}

export default function ContractAnalysisTab({ clientId, clientName, readOnly = false }: Props) {
  const [analyses, setAnalyses] = useState<ContractAnalysis[]>([])
  const [activeAnalysis, setActiveAnalysis] = useState<ContractAnalysis | null>(null)
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
  } = useContractAnalysis(clientId)

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

  const showUploader = !readOnly && status === 'idle' && (composingNew || analyses.length === 0 || uploads.length > 0)
  const showReport = Boolean(displayReport) && !composingNew

  const readOnlyGate = agentTabReadOnlyGate(readOnly, !initialLoadDone, showReport, 'Material Contracts')
  if (readOnlyGate) return readOnlyGate

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 cantara-serif">Contract Analysis</h3>
          <p className="text-xs text-slate-400 mt-0.5">Upload business contracts to evaluate saleability, counterparty restrictions, and buyer risk</p>
          <p className="text-xs text-slate-400 mt-1">Material contracts can also be uploaded in the Documents tab.</p>
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
