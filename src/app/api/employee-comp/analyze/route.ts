import { NextRequest, NextResponse } from 'next/server'
import { analyzePayrollDocument } from '@/lib/employee-comp/analyze'
import {
  assertOpenAiConfiguredForAnalyze,
  parseAnalyzeProvider,
  resolveAnalyzeModelId,
} from '@/lib/agent-analyze-provider'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''

    // JSON body — free-text mode
    if (contentType.includes('application/json')) {
      const { freeText, provider: rawProvider, modelId: requestedModelId } = await req.json()
      if (!freeText || typeof freeText !== 'string') {
        return new Response('freeText is required', { status: 400 })
      }
      const provider = parseAnalyzeProvider(rawProvider)
      const modelId = resolveAnalyzeModelId(provider, requestedModelId)
      if (provider === 'openai') {
        const gate = await assertOpenAiConfiguredForAnalyze()
        if (gate) return gate
      }
      const result = await analyzePayrollDocument({ freeText, provider, modelId })
      return NextResponse.json(result)
    }

    // FormData — file upload mode
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
    const mediaType = file.type || 'application/octet-stream'

    const result = await analyzePayrollDocument({
      fileName: file.name,
      base64,
      mediaType,
      provider,
      modelId,
    })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Employee comp analysis error:', error)
    return new Response(error?.message || 'Internal Server Error', { status: 500 })
  }
}
