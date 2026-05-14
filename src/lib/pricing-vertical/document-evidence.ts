import { GetObjectCommand } from '@aws-sdk/client-s3'
import { createRequire } from 'module'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { assertS3Configured, s3BucketName, s3Client } from '@/lib/s3'
import type { ServicePricingRow } from './types'

const require = createRequire(import.meta.url)
const mammoth: { extractRawText: (args: { buffer: Buffer }) => Promise<{ value: string }> } = require('mammoth')
const { PDFParse } = require('pdf-parse') as {
  PDFParse: new (args: { data: Buffer }) => {
    getText: () => Promise<{ text?: string }>
    destroy: () => Promise<void>
  }
}

const PRICING_DOCUMENT_IDS = new Set([
  'pricing_schedule',
  'revenue_breakdown',
  'monthly_pl_excel',
  'accountant_statements',
  'addback_disclosure',
])

const MAX_DOCS = 8
const MAX_CHARS_PER_DOC = 18_000
const MAX_TOTAL_CHARS = 55_000
const HISTORICAL_PERIODS = ['May 2024', 'Nov 2024', 'May 2025', 'Nov 2025', 'Current']

function isPricingLikeDocument(doc: { documentId?: string | null; fileName: string; aiDetectedType?: string | null }) {
  const haystack = `${doc.documentId ?? ''} ${doc.fileName} ${doc.aiDetectedType ?? ''}`.toLowerCase()
  return (
    (doc.documentId ? PRICING_DOCUMENT_IDS.has(doc.documentId) : false) ||
    /pricing|price|rate|rates|service|vertical|revenue|valuation|financial|p&l|profit|accountant/.test(haystack)
  )
}

async function bodyToBuffer(body: any) {
  if (!body) return Buffer.alloc(0)
  if (typeof body.transformToByteArray === 'function') {
    const bytes = await body.transformToByteArray()
    return Buffer.from(bytes)
  }
  const response = new Response(body)
  return Buffer.from(await response.arrayBuffer())
}

async function fetchDocumentBuffer(doc: { localPath: string; storageBucket?: string | null }) {
  assertS3Configured()
  const result = await s3Client.send(
    new GetObjectCommand({
      Bucket: doc.storageBucket || s3BucketName,
      Key: doc.localPath,
    }),
  )
  return bodyToBuffer(result.Body)
}

function workbookToText(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, raw: false })
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_csv(sheet)
    return `=== SHEET: ${sheetName} ===\n${rows}`
  }).join('\n\n')
}

async function pdfToText(buffer: Buffer) {
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return result.text ?? ''
  } finally {
    await parser.destroy().catch(() => undefined)
  }
}

async function documentToText(doc: { fileName: string; mimeType: string }, buffer: Buffer) {
  const lower = doc.fileName.toLowerCase()
  const mimeType = (doc.mimeType || '').toLowerCase()

  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return workbookToText(buffer)
  }

  if (mimeType.includes('csv') || mimeType.startsWith('text/') || /\.(csv|txt|md)$/i.test(lower)) {
    return buffer.toString('utf8')
  }

  if (mimeType.includes('wordprocessingml') || lower.endsWith('.docx') || lower.endsWith('.doc')) {
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  if (mimeType.includes('pdf') || lower.endsWith('.pdf')) {
    return pdfToText(buffer)
  }

  return buffer.toString('utf8')
}

function compressPricingText(text: string) {
  const lines = text
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const scored = lines
    .map((line, index) => {
      const haystack = line.toLowerCase()
      let score = 0
      if (/\$\s?\d|\b\d+(?:\.\d{2})?\s?(?:usd|cad)\b/i.test(line)) score += 5
      if (/\b(price|pricing|rate|rates|fee|fees|charge|charges|cost|tuition)\b/i.test(line)) score += 4
      if (/\b(boarding|daycare|groom|bath|training|walk|suite|kennel|dog|cat|pet|night|day|half day|full day)\b/i.test(line)) score += 3
      if (/\b(2024|2025|2026|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(line)) score += 3
      if (/\b(revenue|vertical|service line|valuation)\b/i.test(line)) score += 1
      if (haystack.length > 260) score -= 2
      return { line, index, score }
    })
    .filter((item) => item.score >= 4)

  const selected = new Map<number, string>()
  for (const item of scored) {
    for (let index = Math.max(0, item.index - 1); index <= Math.min(lines.length - 1, item.index + 1); index += 1) {
      selected.set(index, lines[index])
    }
  }

  const compact = Array.from(selected.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, line]) => line)
    .join('\n')

  return (compact || lines.slice(0, 120).join('\n')).slice(0, MAX_CHARS_PER_DOC)
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

function inferVertical(serviceName: string) {
  if (/day|pickup|drop|walk|field/i.test(serviceName)) return 'Daycare'
  if (/groom|bath|pamper/i.test(serviceName)) return 'Grooming'
  if (/cat/i.test(serviceName)) return 'Cat Boarding'
  if (/small animal/i.test(serviceName)) return 'Small Animals'
  if (/boarding|kennel|suite|dog/i.test(serviceName)) return 'Boarding'
  return 'Other'
}

function extractStructuredPricingRows(text: string, fileName: string): ServicePricingRow[] {
  const lines = text
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  const rows: ServicePricingRow[] = []
  let group = ''
  let inHistoricalPricingSection = false
  let pastHistoricalPricingSection = false

  for (const line of lines) {
    if (/Historical Pricing by Service/i.test(line)) {
      inHistoricalPricingSection = true
      continue
    }
    if (inHistoricalPricingSection && /Price Change Analysis|Summary Statistics|Monthly Revenue|Revenue Mix/i.test(line)) {
      pastHistoricalPricingSection = true
      inHistoricalPricingSection = false
      continue
    }
    if (pastHistoricalPricingSection || !inHistoricalPricingSection) continue
    if (/^Service\s+Unit\s+May\s+2024/i.test(line)) continue

    if (/^(Dog Boarding|Day & Additional Services|Cat Boarding|Small Animals|Grooming|Bath|Pampering)/i.test(line) && !/£\s?\d/.test(line)) {
      group = line.replace(/\s*\(.*?\)\s*/g, ' ').trim()
      continue
    }

    const prices = Array.from(line.matchAll(/£\s?\d+(?:\.\d{2})?/g)).map((match) => match[0].replace(/\s+/g, ''))
    if (prices.length < 5) continue

    const label = line.replace(/£\s?\d+(?:\.\d{2})?/g, '').replace(/\s+/g, ' ').trim()
    if (!label || /^(Service|May|Nov|current|base)$/i.test(label)) continue
    if (!/[A-Za-z]{3,}/.test(label)) continue

    const serviceName = group && !label.toLowerCase().includes(group.toLowerCase())
      ? `${group} - ${label}`
      : label

    const rowPrices: Record<string, string> = {
      Current: prices[4],
      'Nov 2025': prices[3],
      'May 2025': prices[2],
      'Nov 2024': prices[1],
      'May 2024': prices[0],
    }

    rows.push({
      id: slugify(`${fileName}-${serviceName}`),
      serviceName,
      vertical: inferVertical(serviceName),
      source: 'document',
      sourceUrl: fileName,
      confidence: 'high',
      prices: rowPrices,
    })
  }

  const seen = new Set<string>()
  return rows.filter((row) => {
    const key = row.serviceName.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function collectPricingDocumentEvidence(clientId: string) {
  const docs = await (prisma as any).clientDocument.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      documentId: true,
      fileName: true,
      mimeType: true,
      localPath: true,
      storageBucket: true,
      aiDetectedType: true,
      createdAt: true,
    },
  }) as Array<{
    id: string
    documentId: string | null
    fileName: string
    mimeType: string
    localPath: string
    storageBucket: string | null
    aiDetectedType: string | null
    createdAt: Date
  }>

  const latestByDocumentId = new Map<string, typeof docs[number]>()
  const selected: typeof docs = []
  for (const doc of docs.filter(isPricingLikeDocument)) {
    const key = doc.documentId || doc.id
    if (doc.documentId) {
      if (latestByDocumentId.has(key)) continue
      latestByDocumentId.set(key, doc)
    }
    selected.push(doc)
    if (selected.length >= MAX_DOCS) break
  }

  const evidenceParts: string[] = []
  const sources: Array<{ documentId: string | null; fileName: string; extractedChars: number }> = []
  const structuredPricingRows: ServicePricingRow[] = []

  for (const doc of selected) {
    try {
      const buffer = await fetchDocumentBuffer(doc)
      const rawText = await documentToText(doc, buffer)
      structuredPricingRows.push(...extractStructuredPricingRows(rawText, doc.fileName))
      const compressed = compressPricingText(rawText)
      if (!compressed.trim()) continue
      sources.push({ documentId: doc.documentId, fileName: doc.fileName, extractedChars: compressed.length })
      evidenceParts.push(`=== DOCUMENT: ${doc.fileName} (${doc.documentId ?? 'unclassified'}) ===\n${compressed}`)
    } catch (error) {
      console.warn('[pricing-vertical] Document evidence extraction failed:', doc.fileName, error)
    }
  }

  return {
    sources,
    text: evidenceParts.join('\n\n').slice(0, MAX_TOTAL_CHARS),
    pricingPeriods: HISTORICAL_PERIODS,
    structuredPricingRows,
  }
}
