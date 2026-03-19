'use client'
import { ContractUploader } from '@/components/contract-analysis/ContractUploader'
import { AnalysisProgress } from '@/components/contract-analysis/AnalysisProgress'
import { ContractReport } from '@/components/contract-analysis/ContractReport'
import { useContractAnalysis } from '@/hooks/useContractAnalysis'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ContractAnalysisPage() {
  const {
    documents,
    addDocuments,
    removeDocument,
    analyze,
    status,
    rawMarkdown,
    report,
    error,
    clearAll,
  } = useContractAnalysis()

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 cantara-serif tracking-tight">Contract Analysis Agent</h1>
          <p className="text-slate-500 max-w-2xl">
            Upload business contracts and agreements for buyer-side diligence. The AI identifies transfer restrictions, locked-in obligations, liability exposure, and other transaction risks in real time.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="space-y-8">
          {status !== 'idle' && status !== 'complete' ? (
            <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-100 text-center">
              <AnalysisProgress status={status} rawMarkdown={rawMarkdown} />
            </div>
          ) : !report ? (
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
              <ContractUploader
                documents={documents}
                addDocuments={addDocuments}
                removeDocument={removeDocument}
                status={status}
                onAnalyze={analyze}
              />
            </div>
          ) : (
            <ContractReport
              report={report}
              fileName={documents.map((doc) => doc.name).join(', ')}
              clientName="New Analysis"
              onNewAnalysis={clearAll}
            />
          )}
        </div>
      </div>
    </div>
  )
}
