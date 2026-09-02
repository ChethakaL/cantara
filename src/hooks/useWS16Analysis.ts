'use client'

import { useState, useCallback } from 'react'
import type { AgentAiProvider } from '@/lib/agent-model-provider'
import { resolveAgentModelId } from '@/lib/agent-model-provider'

export type UploadStatus = 'idle' | 'uploading' | 'streaming' | 'complete' | 'error'

export interface UploadedDoc {
  name: string
  base64: string
  mediaType: string
  slotKey: string // e.g. 'employment_agreements', 'handbook'
  sizeBytes?: number
}

interface UseWS16AnalysisOptions {
  clientId: string
  clientName: string
  state?: string
  dba?: string
  totalEmployeesSelfReported?: number | string
  employmentTypeBreakdown?: string
}

export function useWS16Analysis({ clientId, clientName, state, dba, totalEmployeesSelfReported, employmentTypeBreakdown }: UseWS16AnalysisOptions) {
  const [documents, setDocuments] = useState<UploadedDoc[]>([])
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [rawMarkdown, setRawMarkdown] = useState('')
  const [error, setError] = useState<string | null>(null)

  const removeDocument = useCallback((name: string) => {
    setDocuments(prev => prev.filter(d => d.name !== name))
  }, [])

  const clearAll = useCallback(() => {
    setDocuments([])
    setStatus('idle')
    setRawMarkdown('')
    setError(null)
  }, [])

  const analyze = useCallback(async (provider: AgentAiProvider = 'bedrock') => {
    if (documents.length === 0) return
    setStatus('uploading')
    setRawMarkdown('')
    setError(null)

    try {
      const response = await fetch('/api/employee-obligations/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          clientName,
          state: state ?? 'Unknown',
          dba,
          totalEmployeesSelfReported,
          employmentTypeBreakdown,
          documents: documents.map(d => ({
            name: d.name,
            base64: d.base64,
            mediaType: d.mediaType,
          })),
          provider,
          modelId: resolveAgentModelId(provider),
        }),
      })

      if (!response.ok) {
        const msg = await response.text()
        throw new Error(msg || 'Analysis failed')
      }

      setStatus('streaming')
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No response body')

      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setRawMarkdown(accumulated)
      }

      // Check if the streamed content is actually a page-limit error message
      if (accumulated.startsWith('PAGE_LIMIT_EXCEEDED:')) {
        throw new Error(accumulated.replace('PAGE_LIMIT_EXCEEDED: ', ''))
      }

      // Save to database
      await fetch('/api/employee-obligations/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          markdown: accumulated,
          documentNames: documents.map(d => d.name),
          aiProvider: provider,
          aiModel: resolveAgentModelId(provider),
        }),
      })

      setStatus('complete')
    } catch (err: any) {
      console.error('[WS1-6 Hook] Analysis error:', err)
      setError(err.message ?? 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }, [documents, clientId, clientName, state, dba, totalEmployeesSelfReported, employmentTypeBreakdown])

  return {
    documents,
    setDocuments,
    removeDocument,
    clearAll,
    analyze,
    status,
    rawMarkdown,
    error,
  }
}
