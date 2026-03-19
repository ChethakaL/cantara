'use client'
import { useState, useCallback, useEffect } from 'react'
import { FileText, Plus } from 'lucide-react'
import { Button, Card, Modal } from '@/components/ui'
import type { ContractAnalysis } from '@/lib/store'
import { deleteContractAnalysis, getContractAnalyses, saveContractAnalysis } from '@/lib/store'
import { useContractAnalysis } from '@/hooks/useContractAnalysis'
import { ContractUploader } from '../contract-analysis/ContractUploader'
import { AnalysisProgress } from '../contract-analysis/AnalysisProgress'
import { ContractReport } from '../contract-analysis/ContractReport'

interface Props {
  clientId: string
  clientName: string
}

export default function ContractAnalysisTab({ clientId, clientName }: Props) {
  const [analyses, setAnalyses] = useState<ContractAnalysis[]>([])
  const [activeAnalysis, setActiveAnalysis] = useState<ContractAnalysis | null>(null)
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
    clearAll,
  } = useContractAnalysis(clientId)

  const loadAnalyses = useCallback(async () => {
    const data = await getContractAnalyses(clientId)
    setAnalyses(data)
    return data
  }, [clientId])

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

  useEffect(() => {
    loadAnalyses().then((data) => {
      if (data.length > 0 && !activeAnalysis) setActiveAnalysis(data[0])
    })
  }, [loadAnalyses, activeAnalysis])

  useEffect(() => {
    if (status === 'complete' && streamedReport) {
      const allNames = uploads.map((doc) => doc.name).join(', ')

      saveContractAnalysis({
        clientId,
        fileName: allNames,
        report: rawMarkdown,
        parsed: streamedReport,
      }).then((saved) => {
        if (saved?.id) setActiveAnalysis(saved)
        loadAnalyses()
        clearAll()
      })
    }
  }, [status, streamedReport, clientId, rawMarkdown, uploads, loadAnalyses, clearAll])

  const displayReport = (status === 'streaming' || status === 'complete') && streamedReport
    ? streamedReport
    : activeAnalysis?.parsed

  const displayFileName = status === 'streaming' || status === 'complete'
    ? uploads.map((doc) => doc.name).join(', ')
    : activeAnalysis?.fileName || ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 cantara-serif">Contract Analysis</h3>
          <p className="text-xs text-slate-400 mt-0.5">Upload business contracts to evaluate saleability, counterparty restrictions, and buyer risk</p>
        </div>
        {analyses.length > 0 && (
          <Button variant="outline" size="sm" className="gap-2" onClick={clearAll}>
            <Plus className="w-3.5 h-3.5" /> New Analysis
          </Button>
        )}
      </div>

      {analyses.length > 1 && status === 'idle' && (
        <div className="flex gap-2 flex-wrap">
          {analyses.map((analysis) => (
            <button
              key={analysis.id}
              onClick={() => setActiveAnalysis(analysis)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                activeAnalysis?.id === analysis.id ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'
              }`}
            >
              <FileText className="w-3 h-3 inline mr-1.5" />
              {analysis.fileName.length > 30 ? `${analysis.fileName.slice(0, 30)}…` : analysis.fileName}
              <span className="ml-2 text-slate-400">{new Date(analysis.createdAt).toLocaleDateString()}</span>
            </button>
          ))}
        </div>
      )}

      <div className="space-y-6">
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
          <ContractUploader
            documents={uploads}
            addDocuments={addDocuments}
            removeDocument={removeDocument}
            status={status}
            onAnalyze={analyze}
          />
        ) : null}

        {displayReport && (
          <ContractReport
            report={displayReport}
            fileName={displayFileName}
            clientName={clientName}
            onNewAnalysis={clearAll}
            onDelete={activeAnalysis ? () => setDeleteOpen(true) : undefined}
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
