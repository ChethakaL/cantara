import { NextRequest, NextResponse } from 'next/server'
import { analyzeOrgChart, reanalyzeOrgChartFromEdits } from '@/lib/org-chart/analyze'
import type { OrgChartAnalysis } from '@/lib/org-chart/analyze'
import {
  assertOpenAiConfiguredForAnalyze,
  parseAnalyzeProvider,
  resolveAnalyzeModelId,
} from '@/lib/agent-analyze-provider'

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''

    // Edit-aware path: JSON body, no document re-analysis.
    if (contentType.includes('application/json')) {
      const body = await req.json()
      const { reanalyzeFromEdits, existingReport, provider: rawProvider, modelId: requestedModelId } = body ?? {}
      if (!reanalyzeFromEdits) {
        return NextResponse.json({ error: 'JSON body requires reanalyzeFromEdits: true' }, { status: 400 })
      }
      if (!existingReport || typeof existingReport !== 'object' || !Array.isArray(existingReport.roles)) {
        return NextResponse.json({ error: 'reanalyzeFromEdits requires existingReport with roles.' }, { status: 400 })
      }

      const provider = parseAnalyzeProvider(rawProvider)
      const modelId = resolveAnalyzeModelId(provider, requestedModelId)
      if (provider === 'openai') {
        const gate = await assertOpenAiConfiguredForAnalyze()
        if (gate) return gate
      }

      const report = await reanalyzeOrgChartFromEdits(existingReport as OrgChartAnalysis, {
        provider,
        modelId,
      })
      return NextResponse.json({ report })
    }

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
