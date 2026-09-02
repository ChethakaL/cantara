import { NextRequest, NextResponse } from 'next/server'
import { searchPublicRecords, analyzeUploadedDocument } from '@/lib/litigation-search/search'
import {
  assertOpenAiConfiguredForAnalyze,
  parseAnalyzeProvider,
  resolveAnalyzeModelId,
} from '@/lib/agent-analyze-provider'
import { runWithAgentLlmContext } from '@/lib/agent-llm-context'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File
      if (!file) return new Response('No file provided', { status: 400 })

      const provider = parseAnalyzeProvider(formData.get('provider'))
      const modelId = resolveAnalyzeModelId(provider, formData.get('modelId'))
      if (provider === 'openai') {
        const gate = await assertOpenAiConfiguredForAnalyze()
        if (gate) return gate
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const base64 = buffer.toString('base64')
      const mediaType = file.type || 'application/pdf'

      const result = await runWithAgentLlmContext({ provider, modelId }, () =>
        analyzeUploadedDocument({
          fileName: file.name,
          base64,
          mediaType,
        }),
      )
      return NextResponse.json(result)
    }

    const body = await req.json()
    const { businessName, ownerName, state, county, city, provider: rawProvider, modelId: requestedModelId } = body

    if (!businessName || !state) {
      return new Response('businessName and state are required', { status: 400 })
    }

    const provider = parseAnalyzeProvider(rawProvider)
    const modelId = resolveAnalyzeModelId(provider, requestedModelId)
    if (provider === 'openai') {
      const gate = await assertOpenAiConfiguredForAnalyze()
      if (gate) return gate
    }

    const result = await runWithAgentLlmContext({ provider, modelId }, () =>
      searchPublicRecords({
        businessName,
        ownerName: ownerName || '',
        state,
        county,
        city,
      }),
    )
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Litigation search error:', error)
    return new Response(error?.message || 'Internal Server Error', { status: 500 })
  }
}
