'use client'
import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, X, Loader, Plus } from 'lucide-react'
import { Button } from '@/components/ui'
import { LeaseDocument } from '../../lib/lease-analysis/types'
import { AgentModelProviderSelect } from '@/components/admin/AgentModelProviderSelect'
import type { AgentAiProvider } from '@/lib/agent-model-provider'

interface Props {
  documents: LeaseDocument[]
  addDocuments: (files: File[]) => void
  removeDocument: (index: number) => void
  status: string
  onAnalyze: () => void
  provider: AgentAiProvider
  onProviderChange: (provider: AgentAiProvider) => void
}

export function LeaseUploader({ documents, addDocuments, removeDocument, status, onAnalyze, provider, onProviderChange }: Props) {
  const onDrop = useCallback((files: File[]) => {
    addDocuments(files)
  }, [addDocuments])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    disabled: status !== 'idle' && status !== 'error',
  })

  const totalSize = documents.reduce((sum, doc) => sum + doc.sizeBytes, 0)
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      <AgentModelProviderSelect
        value={provider}
        onChange={onProviderChange}
        disabled={status !== 'idle' && status !== 'error'}
      />
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all ${
          isDragActive ? 'border-amber-400 bg-amber-50' : 
          status !== 'idle' && status !== 'error' ? 'border-slate-200 bg-slate-50 cursor-not-allowed' : 
          'border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 cursor-pointer'
        }`}
      >
        <input {...getInputProps()} />
        <div className="space-y-3">
          <Upload className="w-8 h-8 text-slate-300 mx-auto" />
          <div>
            <p className="text-sm font-medium text-slate-600">Drop lease PDFs here</p>
            <p className="text-xs text-slate-400 mt-1">Upload base lease + all amendments, riders, and addenda as separate files</p>
          </div>
          <Button variant="outline" size="sm" disabled={status !== 'idle' && status !== 'error'}>Select Files</Button>
        </div>
      </div>

      {documents.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {documents.length} Document{documents.length > 1 ? 's' : ''} Selected ({formatSize(totalSize)})
            </h4>
            {status === 'idle' && (
              <Button size="sm" onClick={onAnalyze} className="gap-2">
                Run Analysis
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {documents.map((doc, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{doc.name}</p>
                    <p className="text-xs text-slate-400">{formatSize(doc.sizeBytes)}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeDocument(i)}
                  className="p-1 hover:bg-rose-50 rounded-lg text-slate-300 hover:text-rose-500 transition-colors"
                  disabled={status !== 'idle' && status !== 'error'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
