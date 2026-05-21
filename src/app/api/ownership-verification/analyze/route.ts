import Anthropic, {
  APIConnectionError,
  APIConnectionTimeoutError,
  InternalServerError,
  RateLimitError,
} from '@anthropic-ai/sdk'
import { getAnthropicApiKey } from '@/lib/secure-settings'
import { NextRequest, NextResponse } from 'next/server'
import { WS18_SYSTEM_PROMPT, buildWS18ContextBlock } from '@/lib/ws1-8/prompt'
import { prisma } from '@/lib/prisma'
import { parseReport as parseLeaseReport } from '@/lib/lease-analysis/parse-report'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const mammoth: { extractRawText: (args: { buffer: Buffer }) => Promise<{ value: string }> } = require('mammoth')
import sharp from 'sharp'

// Agent spec: claude-sonnet-4-20250514, temperature 0
// Architecture: WS1-8 Corporate Ownership Verification

export const maxDuration = 300 // 5 min — multi-document upload needs time

const MAX_UPSTREAM_ATTEMPTS = 3
const UPSTREAM_RETRY_DELAYS_MS = [1000, 2500]
type MessageStream = AsyncIterable<any> & { controller: { abort: () => void } }

export async function POST(req: NextRequest) {
  try {
    const { documents, clientName, state, dba, entityType, clientId } =
      await req.json()

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return new Response('No documents provided', { status: 400 })
    }

    if (!clientName) {
      return new Response('Missing clientName', { status: 400 })
    }

    let leaseLandlord: string | undefined
    let leaseTenant: string | undefined
    let contractPartyNames: string[] = []
    let employeeAgreementParties: string[] = []

    if (clientId) {
      // Pull lease party names
      try {
        const leaseRecord = await prisma.leaseAnalysis.findFirst({
          where: { clientId },
          orderBy: { createdAt: 'desc' },
        })
        if (leaseRecord?.report) {
          const parsed = parseLeaseReport(leaseRecord.report)
          const findParty = (label: string) => {
            const row = parsed.snapshotTable.find(r => {
              const field = r.field?.toLowerCase() ?? ''
              return field.includes(label) && (field.includes('name') || field === label)
            })
            return row?.finding?.trim()
          }
          leaseLandlord = findParty('landlord')
          leaseTenant = findParty('tenant')
        }
      } catch {
        // Lease cross-check is optional; analysis proceeds without it.
      }

      // Pull entity/party names from Material Contracts
      try {
        const contractRecords = await prisma.contractAnalysis.findMany({
          where: { clientId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { parsed: true },
        })
        for (const cr of contractRecords) {
          const parsed = cr.parsed as any
          if (!parsed) continue
          // Extract party names from snapshot table
          for (const row of (parsed.snapshotTable ?? [])) {
            const field = (row.field ?? '').toLowerCase()
            if (field.includes('party') || field.includes('parties') || field.includes('counterpart') || field.includes('vendor') || field.includes('provider') || field.includes('contractor')) {
              if (row.finding?.trim()) contractPartyNames.push(row.finding.trim())
            }
          }
          // Extract from risk cards
          for (const card of (parsed.contractRiskCards ?? [])) {
            if (card.contractName?.trim()) contractPartyNames.push(card.contractName.trim())
          }
          // Extract from document inventory
          for (const doc of (parsed.documentInventory ?? [])) {
            if (doc.document?.trim()) contractPartyNames.push(doc.document.trim())
          }
        }
        contractPartyNames = Array.from(new Set(contractPartyNames))
      } catch {
        // Contract cross-check is optional.
      }

      // Pull entity names from Employee Obligations agreements
      try {
        const empReport = await (prisma as any).employeeObligationsReport.findFirst({
          where: { clientId },
          orderBy: { createdAt: 'desc' },
          select: { metadata: true },
        })
        if (empReport?.metadata) {
          const meta = empReport.metadata as any
          // Extract agreement parties from parsed report if available
          const parsedReport = meta.parsedReport ?? meta
          for (const agreement of (parsedReport.agreements ?? [])) {
            if (agreement.role?.trim()) employeeAgreementParties.push(agreement.role.trim())
          }
          for (const doc of (parsedReport.documents ?? [])) {
            if (doc.partiesCovered?.trim()) employeeAgreementParties.push(doc.partiesCovered.trim())
          }
        }
        employeeAgreementParties = Array.from(new Set(employeeAgreementParties))
      } catch {
        // Employee obligations cross-check is optional.
      }
    }

    const contextBlock = buildWS18ContextBlock({
      clientName,
      state: state ?? 'Unknown',
      dba,
      entityType,
      leaseLandlord,
      leaseTenant,
      contractPartyNames: contractPartyNames.length > 0 ? contractPartyNames : undefined,
      employeeAgreementParties: employeeAgreementParties.length > 0 ? employeeAgreementParties : undefined,
    })

    // Files Passed to Agent:
    // - PDFs -> base64-encoded, passed as a `document` content block
    // - DOCX -> converted to plain text via portal pre-processing
    // - XLSX -> pre-processed into a structured Markdown table
    // - PNG -> passed as image block for visual analysis
    const contentBlocks = await Promise.all(
      documents.map(async (doc: any) => {
        const name: string = doc.name ?? ''
        const ext = name.toLowerCase()

        // PNG / JPEG -> image block
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
            console.error(`[WS1-8] Image resize failed for ${name}:`, err)
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

        // PDFs -> document block
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

        // Convert XLSX to text
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

            return {
              type: 'text' as const,
              text: csvText
            }
          } catch (err) {
            console.error(`[WS1-8] XLSX parsing failed for ${name}:`, err)
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
            console.error(`[WS1-8] DOCX parsing failed for ${name}:`, err)
          }
        }

        // Fallback: plain text
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
        text: `Please analyze the ${documents.length} corporate/ownership document(s) above for ${clientName}. Produce the full Corporate Ownership Verification Report as specified in your instructions. Document names: ${documents.map((d: any) => d.name).join(', ')}`,
      },
    ]

    const client = new Anthropic({
      apiKey: await getAnthropicApiKey(),
    })

    let activeStream: MessageStream | null = null

    const readableStream = new ReadableStream({
      async start(controller) {
        let fullResponse = ''
        for (let attempt = 1; attempt <= MAX_UPSTREAM_ATTEMPTS; attempt++) {
          let sawText = false
          try {
            activeStream = await client.messages.stream({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 8000,
              temperature: 0,
              system: WS18_SYSTEM_PROMPT,
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

            console.log('[WS1-8] Claude response complete. Total length:', fullResponse.length)
            controller.close()
            return
          } catch (error) {
            activeStream?.controller.abort()
            activeStream = null

            const shouldRetry =
              !sawText &&
              attempt < MAX_UPSTREAM_ATTEMPTS &&
              isRetryableError(error)

            console.error(`[WS1-8] Attempt ${attempt} failed:`, error)

            if (!shouldRetry) {
              controller.error(error instanceof Error ? error : new Error(String(error)))
              return
            }

            await delay(UPSTREAM_RETRY_DELAYS_MS[attempt - 1] ?? 3000)
          }
        }
      },
      cancel() {
        console.log('[WS1-8] Stream cancelled by client.')
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
    console.error('[WS1-8 Analyze Error]:', error)
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
  const message = error instanceof Error ? error.message : 'Ownership verification analysis failed.'
  if (isRetryableError(error)) {
    return `Transient upstream connection error while running WS1-8 Ownership Verification analysis. ${message}`
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
