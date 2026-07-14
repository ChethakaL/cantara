import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAIClient, resolveModel } from '@/lib/ai-client'
import { buildRealEstateAppraisalPrompt } from '@/lib/real-estate-appraisal/prompt'

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const clientId = String(body.clientId || '')
    const name = String(body.fileName || 'Real estate appraisal')
    const base64 = String(body.base64 || '')
    if (!clientId || !base64) return new Response('clientId and appraisal document are required', { status: 400 })

    const client = await prisma.clientProfile.findUnique({ where: { id: clientId }, select: { businessName: true } })
    if (!client) return new Response('Client not found', { status: 404 })

    const anthropic = await requireAIClient()
    const mediaType = String(body.mediaType || 'application/pdf')
    const content: any[] = [{ type: 'text', text: `Business details: Registered business name: ${client.businessName}\nUploaded document: ${name}` }]
    if (mediaType === 'application/pdf') {
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } })
    } else if (mediaType.startsWith('image/')) {
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } })
    } else {
      return new Response('Appraisal must be a PDF or image', { status: 400 })
    }
    content.push({ type: 'text', text: 'Analyze this one appraisal document and return the requested report.' })

    const result = await anthropic.messages.create({
      model: resolveModel('claude-sonnet-4-20250514'),
      max_tokens: 12000,
      temperature: 0,
      system: buildRealEstateAppraisalPrompt(client.businessName),
      messages: [{ role: 'user', content }],
    })
    const markdown = result.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n')
    const report = await (prisma as any).realEstateAppraisalReport.create({
      data: { clientId, markdown, documentNames: [name], metadata: { businessName: client.businessName, mediaType } },
    })
    return NextResponse.json({ id: report.id, markdown })
  } catch (error) {
    console.error('[real-estate-appraisal/analyze]', error)
    return NextResponse.json({ error: 'Real estate appraisal analysis failed.' }, { status: 500 })
  }
}
