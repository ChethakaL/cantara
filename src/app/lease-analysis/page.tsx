'use client'
import { LeaseUploader } from '@/components/lease-analysis/LeaseUploader'
import { AnalysisProgress } from '@/components/lease-analysis/AnalysisProgress'
import { LeaseReport } from '@/components/lease-analysis/LeaseReport'
import { useLeaseAnalysis } from '@/hooks/useLeaseAnalysis'
import { Button } from '@/components/ui'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function LeaseAnalysisPage() {
  const { 
    documents, 
    addDocuments, 
    removeDocument,
    analyze, 
    status, 
    rawMarkdown, 
    report, 
    error,
    clearAll
  } = useLeaseAnalysis()

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Navigation */}
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 cantara-serif tracking-tight">Lease Analysis Agent</h1>
          <p className="text-slate-500 max-w-2xl">
            Upload commercial lease documents for comprehensive M&A due diligence. 
            Our AI identifies red flags, extracts key terms, and generates an investor-ready report in real-time.
          </p>
        </div>

        {/* Status / Error Messages */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Main Interface */}
        <div className="space-y-8">
          {status !== 'idle' && status !== 'complete' ? (
            <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-100 text-center">
              <AnalysisProgress status={status} rawMarkdown={rawMarkdown} />
            </div>
          ) : !report ? (
            <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
              <LeaseUploader 
                documents={documents}
                addDocuments={addDocuments}
                removeDocument={removeDocument}
                status={status}
                onAnalyze={analyze}
              />
            </div>
          ) : (
            <LeaseReport 
              report={report}
              fileName={documents.map(d => d.name).join(', ')}
              clientName="New Analysis"
              onNewAnalysis={clearAll}
            />
          )}
        </div>
      </div>
    </div>
  )
}
