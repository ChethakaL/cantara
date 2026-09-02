'use client'

import { useState, useCallback } from 'react'
import type { AgentAiProvider } from '@/lib/agent-model-provider'
import { resolveAgentModelId } from '@/lib/agent-model-provider'

export type UploadStatus = 'idle' | 'uploading' | 'streaming' | 'complete' | 'error'

export interface UploadedDoc {
  name: string
  base64: string
  mediaType: string
  slotKey: string
  sizeBytes?: number
}

interface UseWS111AnalysisOptions {
  clientId: string
  clientName: string
  state?: string
  entityType?: string
  fiscalYearEnd?: string
  numberOfEmployees?: string
}

export function useWS111Analysis({ clientId, clientName, state, entityType, fiscalYearEnd, numberOfEmployees }: UseWS111AnalysisOptions) {
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
      const response = await fetch('/api/tax-liability-review/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          clientName,
          state: state ?? 'Unknown',
          entityType,
          fiscalYearEnd,
          numberOfEmployees,
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

      if (accumulated.startsWith('PAGE_LIMIT_EXCEEDED:')) {
        throw new Error(accumulated.replace('PAGE_LIMIT_EXCEEDED: ', ''))
      }

      const saveRes = await fetch('/api/tax-liability-review/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          markdown: accumulated,
          documentNames: documents.map(d => d.name),
          documentSlots: documents.map(d => d.slotKey),
          aiProvider: provider,
          aiModel: resolveAgentModelId(provider),
        }),
      })
      if (!saveRes.ok) {
        throw new Error(await saveRes.text().catch(() => 'Failed to save tax liability report'))
      }

      setStatus('complete')
    } catch (err: any) {
      console.error('[WS1-11 Hook] Analysis error:', err)
      setError(err.message ?? 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }, [documents, clientId, clientName, state, entityType, fiscalYearEnd, numberOfEmployees])

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
