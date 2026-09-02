import { NextRequest, NextResponse } from 'next/server'
import { analyzeOrgChart } from '@/lib/org-chart/analyze'
import {
  assertOpenAiConfiguredForAnalyze,
  parseAnalyzeProvider,
  resolveAnalyzeModelId,
} from '@/lib/agent-analyze-provider'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
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

    const result = await analyzeOrgChart({
      fileName: file.name,
      base64,
      mediaType,
      provider,
      modelId,
    })
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Org chart analysis error:', error)
    return new Response(error?.message || 'Internal Server Error', { status: 500 })
  }
}
