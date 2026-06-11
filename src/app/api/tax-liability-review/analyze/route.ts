import Anthropic, {
  APIConnectionError,
  APIConnectionTimeoutError,
  InternalServerError,
  RateLimitError,
} from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from '@/lib/secure-settings'
import { NextRequest, NextResponse } from 'next/server'
import { WS111_SYSTEM_PROMPT, buildWS111ContextBlock } from '@/lib/ws1-11/prompt'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const mammoth: { extractRawText: (args: { buffer: Buffer }) => Promise<{ value: string }> } = require('mammoth')
import sharp from 'sharp'
import { getAIClient, requireAIClient, resolveModel, usesBedrock } from "@/lib/ai-client"

export const maxDuration = 300

const MAX_UPSTREAM_ATTEMPTS = 3
const UPSTREAM_RETRY_DELAYS_MS = [1000, 2500]
type MessageStream = AsyncIterable<any> & { controller: { abort: () => void } }

export async function POST(req: NextRequest) {
  try {
    const { documents, clientName, state, entityType, fiscalYearEnd, numberOfEmployees } =
      await req.json()

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return new Response('No documents provided', { status: 400 })
    }

    if (!clientName) {
      return new Response('Missing clientName', { status: 400 })
    }

    const contextBlock = buildWS111ContextBlock({
      clientName,
      state: state ?? 'Unknown',
      entityType,
      fiscalYearEnd,
      numberOfEmployees,
    })

    const contentBlocks = await Promise.all(
      documents.map(async (doc: any) => {
        const name: string = doc.name ?? ''
        const ext = name.toLowerCase()

        if (
          doc.mediaType === 'image/png' ||
          doc.mediaType === 'image/jpeg' ||
          ext.endsWith('.png') ||
          ext.endsWith('.jpg') ||
          ext.endsWith('.jpeg')
        ) {
          try {
            const buffer = Buffer.from(doc.base64, 'base64')
            const resizedBuffer = await sharp(buffer)
              .resize(1568, 1568, { fit: 'inside', withoutEnlargement: true })
              .toBuffer()

            return {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: doc.mediaType === 'image/jpeg' ? ('image/jpeg' as const) : ('image/png' as const),
                data: resizedBuffer.toString('base64'),
              },
            }
          } catch (err) {
            console.error(`[WS1-11] Image resize failed for ${name}:`, err)
            return {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: doc.mediaType === 'image/jpeg' ? ('image/jpeg' as const) : ('image/png' as const),
                data: doc.base64,
              },
            }
          }
        }

        if (doc.mediaType === 'application/pdf' || ext.endsWith('.pdf')) {
          return {
            type: 'document' as const,
            source: {
              type: 'base64' as const,
              media_type: 'application/pdf' as const,
              data: doc.base64,
            },
          }
        }

        if (ext.endsWith('.xlsx')) {
          try {
            const xlsx = require('xlsx')
            const buffer = Buffer.from(doc.base64, 'base64')
            const workbook = xlsx.read(buffer, { type: 'buffer' })
            let csvText = `=== DOCUMENT: ${name} ===\n\n`
            for (const sheetName of workbook.SheetNames) {
              const worksheet = workbook.Sheets[sheetName]
              csvText += `## Sheet: ${sheetName}\n\n`
              const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as Array<Array<string | number | boolean | null>>
              csvText += toMarkdownTable(rows) + '\n\n'
            }
            csvText += `=== END OF: ${name} ===`
            return { type: 'text' as const, text: csvText }
          } catch (err) {
            console.error(`[WS1-11] XLSX parsing failed for ${name}:`, err)
          }
        }

        if (ext.endsWith('.docx') || doc.mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          try {
            const buffer = Buffer.from(doc.base64, 'base64')
            const result = await mammoth.extractRawText({ buffer })
            return {
              type: 'text' as const,
              text: `=== DOCUMENT: ${name} ===\n\n${result.value.trim() || '[No readable text extracted from DOCX]'}\n\n=== END OF: ${name} ===`,
            }
          } catch (err) {
            console.error(`[WS1-11] DOCX parsing failed for ${name}:`, err)
          }
        }

        return {
          type: 'text' as const,
          text: `=== DOCUMENT: ${name} ===\n\n${
            doc.text ?? '[No text content — re-upload as PDF for best results]'
          }\n\n=== END OF: ${name} ===`,
        }
      })
    )

    const userContent: any[] = [
      { type: 'text', text: contextBlock },
      ...contentBlocks,
      {
        type: 'text',
        text: `Please analyze the ${documents.length} tax document(s) above for ${clientName}. Produce the full Tax Liability Review Report as specified in your instructions. Document names: ${documents.map((d: any) => d.name).join(', ')}`,
      },
    ]

    const client = await requireAIClient()

    let activeStream: MessageStream | null = null

    const readableStream = new ReadableStream({
      async start(controller) {
        let fullResponse = ''
        for (let attempt = 1; attempt <= MAX_UPSTREAM_ATTEMPTS; attempt++) {
          let sawText = false
          try {
            activeStream = await client.messages.stream({
              model: resolveModel('claude-sonnet-4-20250514'),
              max_tokens: 12000,
              temperature: 0,
              system: WS111_SYSTEM_PROMPT,
              messages: [{ role: 'user', content: userContent }],
            })

            for await (const chunk of activeStream) {
              if (
                chunk.type === 'content_block_delta' &&
                chunk.delta.type === 'text_delta'
              ) {
                const text = chunk.delta.text
                sawText = true
                fullResponse += text
                controller.enqueue(new TextEncoder().encode(text))
              }
            }

            console.log('[WS1-11] Claude response complete. Total length:', fullResponse.length)
            controller.close()
            return
          } catch (error) {
            activeStream?.controller.abort()
            activeStream = null

            const shouldRetry =
              !sawText &&
              attempt < MAX_UPSTREAM_ATTEMPTS &&
              isRetryableError(error)

            console.error(`[WS1-11] Attempt ${attempt} failed:`, error)

            if (!shouldRetry) {
              controller.error(error instanceof Error ? error : new Error(String(error)))
              return
            }

            await delay(UPSTREAM_RETRY_DELAYS_MS[attempt - 1] ?? 3000)
          }
        }
      },
      cancel() {
        console.log('[WS1-11] Stream cancelled by client.')
        activeStream?.controller.abort()
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error: any) {
    console.error('[WS1-11 Analyze Error]:', error)
    return NextResponse.json(
      { error: formatError(error) },
      { status: isRetryableError(error) ? 503 : 500 }
    )
  }
}

function isRetryableError(error: unknown) {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: number }).status)
      : undefined
  const message = error instanceof Error ? error.message : String(error)

  return (
    error instanceof APIConnectionError ||
    error instanceof APIConnectionTimeoutError ||
    error instanceof RateLimitError ||
    error instanceof InternalServerError ||
    status === 408 ||
    status === 429 ||
    (typeof status === 'number' && status >= 500) ||
    /network error|connection error|fetch failed|timeout|socket hang up|econnreset/i.test(message)
  )
}

function formatError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Tax liability review analysis failed.'
  if (isRetryableError(error)) {
    return `Transient upstream connection error while running WS1-11 Tax Liability Review analysis. ${message}`
  }
  return message
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function toMarkdownTable(rows: Array<Array<string | number | boolean | null>>) {
  const normalized = rows
    .map(row => row.map(cell => String(cell ?? '').replace(/\|/g, '\\|').trim()))
    .filter(row => row.some(cell => cell.length > 0))

  if (normalized.length === 0) return '_No tabular data found._'

  const width = Math.max(...normalized.map(row => row.length))
  const padded = normalized.map(row => {
    const next = [...row]
    while (next.length < width) next.push('')
    return next
  })

  const header = padded[0]
  const separator = header.map(() => '---')
  const body = padded.slice(1)

  return [
    `| ${header.join(' | ')} |`,
    `| ${separator.join(' | ')} |`,
    ...body.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')
}
