import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { hasAIConfigured, requireAIClient, resolveModel } from '@/lib/ai-client'

const FIELD_CONFIG: Record<string, { label: string; format: string }> = {
  professionalAdvisorsList: {
    label: 'professional advisors',
    format: 'Role | Name | Company | Email | Phone | Willing yes/no/unknown | Notes',
  },
  vendorDirectoryList: {
    label: 'software and vendors',
    format: 'Tool name | Vendor company | Category | Annual cost | Contract status | Transferable yes/no/unknown | Login access | Notes',
  },
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const fieldKey = String(body.fieldKey ?? '')
  const transcript = String(body.transcript ?? '').slice(0, 30000)
  const config = FIELD_CONFIG[fieldKey]

  if (!config || !transcript.trim()) {
    return new Response('fieldKey and transcript required', { status: 400 })
  }

  if (!(await hasAIConfigured())) {
    return NextResponse.json({ text: transcript.trim(), fallback: true })
  }

  const client = await requireAIClient()
  const result = await client.messages.create({
    model: resolveModel('claude-3-5-haiku-latest'),
    max_tokens: 1200,
    temperature: 0,
    system: `Extract ${config.label} from a transcript or pasted notes.
Return ONLY plain text lines. No markdown, no commentary.
Each line must use this exact pipe-separated format:
${config.format}
If a field is not found, leave that segment blank but keep the pipes.
Only include real entities mentioned in the text. Do not invent rows.`,
    messages: [{ role: 'user', content: transcript }],
  })

  const text = result.content
    .filter(block => block.type === 'text')
    .map(block => ('text' in block ? block.text : ''))
    .join('\n')
    .trim()

  return NextResponse.json({ text: text || transcript.trim(), fallback: !text })
}
