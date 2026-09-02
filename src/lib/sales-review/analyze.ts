import mammoth from 'mammoth'
import { createRequire } from 'module'
import { buildSalesProcessReviewSystemPrompt, normalizeSalesProcessResult } from './prompt'
import type { SalesProcessReviewResult } from './types'
import type { AgentAiProvider } from '@/lib/agent-model-provider'
import { requireAIClient, resolveModel } from '@/lib/ai-client'
import { createAgentMessage } from '@/lib/llm-completion'

const require = createRequire(import.meta.url)
const { PDFParse } = require('pdf-parse') as {
  PDFParse: new (args: { data: Buffer }) => {
    getText: () => Promise<{ text?: string }>
    destroy: () => Promise<void>
  }
}

const MAX_TRANSCRIPT_CHARS = 120_000

function stripJsonFence(text: string) {
  const t = text.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t)
  if (fence) return fence[1].trim()
  return t
}

function parseJsonFromClaude(text: string): unknown {
  const cleaned = stripJsonFence(text)
  try {
    return JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1))
      } catch {
        /* ignore */
      }
    }
    throw new Error('Model did not return valid JSON.')
  }
}

export async function extractTranscriptText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  const mt = (mimeType || '').toLowerCase()
  const lower = fileName.toLowerCase()

  if (mt.includes('text/plain') || lower.endsWith('.txt')) {
    return buffer.toString('utf8').slice(0, MAX_TRANSCRIPT_CHARS)
  }

  if (
    mt.includes('wordprocessingml') ||
    mt.includes('application/msword') ||
    lower.endsWith('.docx') ||
    lower.endsWith('.doc')
  ) {
    const { value } = await mammoth.extractRawText({ buffer })
    return value.slice(0, MAX_TRANSCRIPT_CHARS)
  }

  // Default: treat as PDF
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return (result.text ?? '').slice(0, MAX_TRANSCRIPT_CHARS)
  } finally {
    await parser.destroy().catch(() => undefined)
  }
}

export async function analyzeSalesProcessTranscript(args: {
  transcriptText: string
  businessName: string
  provider?: AgentAiProvider
  modelId?: string
}): Promise<SalesProcessReviewResult> {
    const trimmed = args.transcriptText.trim()
  if (!trimmed) {
    return normalizeSalesProcessResult({
      summary: 'No readable text was extracted from the uploaded file.',
      keyFindings: ['The file appears empty or could not be parsed as text/PDF/DOCX.'],
      benchmarkComparisons: [],
      recommendations: ['Upload a .txt, .pdf, or .docx transcript with visible text (not only scanned images without OCR).'],
      generatedAt: new Date().toISOString(),
    })
  }

  const todayIso = new Date().toISOString()
  const system = buildSalesProcessReviewSystemPrompt({
    businessName: args.businessName || 'Client',
    todayIso,
  })

  const provider = args.provider ?? 'bedrock'
  const userText = `--- TRANSCRIPT / NOTES START ---\n${trimmed.slice(0, MAX_TRANSCRIPT_CHARS)}\n--- TRANSCRIPT / NOTES END ---`

  let text: string
  if (provider === 'openai') {
    text = await createAgentMessage({
      provider,
      model: args.modelId,
      system,
      content: userText,
      maxTokens: 8192,
      temperature: 0,
    })
  } else {
    const client = await requireAIClient()
    const result = await client.messages.create({
      model: resolveModel('claude-sonnet-4-20250514'),
      max_tokens: 8192,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: [{ type: 'text', text: userText }] }],
    })
    text = result.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
  }

  const parsed = parseJsonFromClaude(text)
  return normalizeSalesProcessResult(parsed)
}
