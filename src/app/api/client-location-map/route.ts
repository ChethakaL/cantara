import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { assertS3Configured, s3BucketName, s3Client } from '@/lib/s3'
import {
  parseCsvText,
  parseXlsxBuffer,
} from '@/lib/client-location-map/parse-addresses'
import { extractAddressesWithClaudeCodeExecution } from '@/lib/client-location-map/claude-extract-addresses'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function bodyToBuffer(body: any): Promise<Buffer> {
  if (!body) return Buffer.alloc(0)
  if (typeof body.transformToByteArray === 'function') {
    const bytes = await body.transformToByteArray()
    return Buffer.from(bytes)
  }
  const response = new Response(body)
  return Buffer.from(await response.arrayBuffer())
}

// ── GET: Fetch existing map data & uploaded document info ────────────────────

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, any>
  const mapData = submissions.clientLocationMap ?? null

  const uploadedDoc = await (prisma as any).clientDocument.findFirst({
    where: { clientId, documentId: 'client_addresses' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, fileName: true, createdAt: true },
  })
  const docStatus = await (prisma as any).clientDocumentStatus.findUnique({
    where: { clientId_documentId: { clientId, documentId: 'client_addresses' } },
    select: { fileName: true, uploadedAt: true },
  })

  const uploaded = uploadedDoc
    ? { recordId: uploadedDoc.id, fileName: uploadedDoc.fileName, uploadedAt: uploadedDoc.createdAt }
    : docStatus?.fileName
      ? { recordId: null, fileName: docStatus.fileName, uploadedAt: docStatus.uploadedAt }
      : null

  return NextResponse.json({ mapData, uploadedDoc: uploaded })
}

// ── POST: Parse uploaded CSV/XLSX and return structured data ─────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const clientId = formData.get('clientId') as string
    const facilityAddress = formData.get('facilityAddress') as string
    const file = formData.get('file') as File | null
    const useUploadedDoc = formData.get('useUploadedDoc') === 'true'

    if (!clientId) return new Response('Missing clientId', { status: 400 })

    const client = await prisma.clientProfile.findUnique({
      where: { id: clientId },
      select: { id: true },
    })
    if (!client) return new Response('Client not found', { status: 404 })

    let buffer: Buffer
    let fileName = ''

    if (file) {
      buffer = Buffer.from(await file.arrayBuffer())
      fileName = file.name
    } else if (useUploadedDoc || !file) {
      const doc = await (prisma as any).clientDocument.findFirst({
        where: { clientId, documentId: 'client_addresses' },
        orderBy: { createdAt: 'desc' },
        select: { fileName: true, localPath: true, storageBucket: true },
      })
      if (!doc?.localPath) {
        return new Response('No uploaded client address document found.', { status: 404 })
      }
      assertS3Configured()
      const s3Res = await s3Client.send(
        new GetObjectCommand({
          Bucket: doc.storageBucket || s3BucketName,
          Key: doc.localPath,
        })
      )
      buffer = await bodyToBuffer(s3Res.Body)
      fileName = doc.fileName || 'client_addresses.csv'
    } else {
      return new Response('Missing file or uploaded document', { status: 400 })
    }

    const ext = (fileName.split('.').pop() || '').toLowerCase()

    let parseResult =
      ext === 'xlsx' || ext === 'xls' ? parseXlsxBuffer(buffer) : parseCsvText(buffer.toString('utf-8'))

    // Unrecognized layouts (e.g. Street Address without matching our schema previously,
    // or totally custom exports) go through Claude code execution for a clean JSON extract.
    if (!parseResult.parserMatched || parseResult.clients.length === 0) {
      console.info(
        '[client-location-map] Native parser did not match headers; using Claude code execution',
        { fileName },
      )
      const clients = await extractAddressesWithClaudeCodeExecution(buffer, fileName)
      parseResult = { clients, parserMatched: false, source: 'claude' }
    }

    if (!parseResult.clients.length) {
      return new Response(
        'No valid client addresses found. Download the Cantara Customer Address List template, fill it in, and upload again — or upload a spreadsheet with clear address / city / state columns.',
        { status: 400 },
      )
    }

    return NextResponse.json({
      clients: parseResult.clients,
      fileName,
      facilityAddress: facilityAddress || '',
      rowCount: parseResult.clients.length,
      parseSource: parseResult.source,
    })
  } catch (error) {
    console.error('[client-location-map] POST error:', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return new Response(message, { status: 500 })
  }
}

// ── PATCH: Save geocoded map data (+ optional Bedrock insight refresh on edit) ─

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const clientId = String(body.clientId || '')
    let mapData = body.mapData
    const reanalyzeFromEdits = Boolean(body.reanalyzeFromEdits)
    const statsSnapshot = body.statsSnapshot
    const clientName = typeof body.clientName === 'string' ? body.clientName : undefined

    if (!clientId || !mapData) {
      return new Response('clientId and mapData required', { status: 400 })
    }

    // Edit-only AI path: refresh insights/narrative from advisor-overridden stats via Bedrock (no UI provider choice).
    if (reanalyzeFromEdits) {
      if (!statsSnapshot || typeof statsSnapshot !== 'object') {
        return NextResponse.json(
          { error: 'reanalyzeFromEdits requires statsSnapshot.' },
          { status: 400 },
        )
      }
      const { reanalyzeLocationMapInsightsFromEdits } = await import('@/lib/client-location-map/reanalyze')
      const refreshed = await reanalyzeLocationMapInsightsFromEdits({
        ...statsSnapshot,
        facilityAddress: mapData.facilityAddress,
        clientName,
      })
      mapData = {
        ...mapData,
        insights: refreshed.insights,
        narrativeSummary: refreshed.narrativeSummary,
        insightsUpdatedAt: new Date().toISOString(),
      }
    }

    const client = await prisma.clientProfile.findUnique({
      where: { id: clientId },
      select: { sectionSubmissions: true },
    })
    if (!client) return new Response('Client not found', { status: 404 })

    const current = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
      ? client.sectionSubmissions
      : {}) as Record<string, any>

    await prisma.clientProfile.update({
      where: { id: clientId },
      data: {
        sectionSubmissions: {
          ...current,
          clientLocationMap: {
            ...mapData,
            updatedAt: new Date().toISOString(),
          },
        },
      },
    })

    return NextResponse.json({ success: true, mapData })
  } catch (error) {
    console.error('[client-location-map] PATCH error:', error)
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return new Response(message, { status: 500 })
  }
}
