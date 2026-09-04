import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAIClient, resolveModel } from '@/lib/ai-client'
import { buildRealEstateAppraisalPrompt } from '@/lib/real-estate-appraisal/prompt'
import {
  parseAnalyzeProvider,
  resolveAnalyzeModelId,
} from '@/lib/agent-analyze-provider'
import { createAgentMessage, type AgentMessageBlock } from '@/lib/llm-completion'
import { hasOpenAiConfigured } from '@/lib/openai-client'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      clientId: rawClientId,
      fileName,
      base64: rawBase64,
      mediaType: rawMediaType,
      provider: rawProvider,
      modelId: requestedModelId,
    } = body
    const clientId = String(rawClientId || '')
    const name = String(fileName || 'Real estate appraisal')
    const base64 = String(rawBase64 || '')
    if (!clientId || !base64) return new Response('clientId and appraisal document are required', { status: 400 })

    const client = await prisma.clientProfile.findUnique({ where: { id: clientId }, select: { businessName: true } })
    if (!client) return new Response('Client not found', { status: 404 })

    const mediaType = String(rawMediaType || 'application/pdf')
    const userContent: AgentMessageBlock[] = [
      {
        type: 'text',
        text: `Business details: Registered business name: ${client.businessName}\nUploaded document: ${name}`,
      },
    ]
    if (mediaType === 'application/pdf') {
      userContent.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } })
    } else if (mediaType.startsWith('image/')) {
      userContent.push({ type: 'image', source: { media_type: mediaType, data: base64 } })
    } else {
      return new Response('Appraisal must be a PDF or image', { status: 400 })
    }
    userContent.push({ type: 'text', text: 'Analyze this one appraisal document and return the requested report.' })

    const provider = parseAnalyzeProvider(rawProvider)
    const modelId = resolveAnalyzeModelId(provider, requestedModelId)
    const systemPrompt = buildRealEstateAppraisalPrompt(client.businessName)

    let markdown: string
    if (provider === 'openai') {
      if (!(await hasOpenAiConfigured())) {
        return new Response('OpenAI API key is not configured. Add it in Admin Settings.', { status: 400 })
      }
      // Complete + persist (same contract as Bedrock). Do not stream — the UI reloads
      // saved reports and previously discarded OpenAI streams without saving.
      markdown = await createAgentMessage({
        provider,
        model: modelId,
        system: systemPrompt,
        content: userContent,
        maxTokens: 12000,
        temperature: 0,
      })
    } else {
      const anthropic = await requireAIClient()
      const result = await anthropic.messages.create({
        model: resolveModel('claude-sonnet-4-20250514'),
        max_tokens: 12000,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent as any }],
      })
      markdown = result.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n')
    }

    if (!markdown.trim()) {
      return NextResponse.json({ error: 'Model returned an empty appraisal report.' }, { status: 502 })
    }

    const report = await (prisma as any).realEstateAppraisalReport.create({
      data: {
        clientId,
        markdown,
        documentNames: [name],
        metadata: { businessName: client.businessName, mediaType },
        aiProvider: provider,
        aiModel: modelId,
      },
    })
    return NextResponse.json({ id: report.id, markdown, aiProvider: provider, aiModel: modelId })
  } catch (error) {
    console.error('[real-estate-appraisal/analyze]', error)
    const message = error instanceof Error ? error.message : 'Real estate appraisal analysis failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
