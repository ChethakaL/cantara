import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertS3Configured, s3BucketName, s3Client } from '@/lib/s3'
import { analyzeSalesProcessTranscript, extractTranscriptText } from '@/lib/sales-review/analyze'
import { normalizeSalesProcessResult } from '@/lib/sales-review/prompt'

export const maxDuration = 180

const DOCUMENT_ID = 'sales_process_transcript'

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0)
  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray()
    return Buffer.from(bytes)
  }
  const response = new Response(body as BodyInit)
  return Buffer.from(await response.arrayBuffer())
}

export async function POST(req: NextRequest) {
  try {
    assertS3Configured()

    let clientId: string
    try {
      const body = await req.json()
      clientId = String(body?.clientId || '').trim()
    } catch {
      return new Response('Invalid JSON body', { status: 400 })
    }

    if (!clientId) {
      return new Response('clientId is required', { status: 400 })
    }

    const profile = await prisma.clientProfile.findUnique({
      where: { id: clientId },
      select: { businessName: true },
    })
    if (!profile) {
      return new Response('Client not found', { status: 404 })
    }

    const document = await (prisma as any).clientDocument.findFirst({
      where: { clientId, documentId: DOCUMENT_ID },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        localPath: true,
        storageBucket: true,
        mimeType: true,
        fileName: true,
      },
    })

    if (!document?.localPath) {
      return new Response(
        'No sales process transcript uploaded. Upload a file in Documents or via this tab first.',
        { status: 400 },
      )
    }

    const obj = await s3Client.send(
      new GetObjectCommand({
        Bucket: document.storageBucket || s3BucketName,
        Key: document.localPath,
      }),
    )

    const buffer = await bodyToBuffer(obj.Body)
    const transcriptText = await extractTranscriptText(buffer, document.mimeType || '', document.fileName || 'transcript')

    const result = await analyzeSalesProcessTranscript({
      transcriptText,
      businessName: profile.businessName || 'Client',
    })

    await (prisma as any).clientDocument.update({
      where: { id: document.id },
      data: {
        aiDetectedType: 'sales_process_review',
        aiReviewStatus: 'complete',
        aiReviewSummary: JSON.stringify(result),
        aiReviewFlags: [],
        aiReviewedAt: new Date(),
      },
    })

    return NextResponse.json(result)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Sales process review failed.'
    console.error('[sales-review/analyze]', error)
    return new Response(message, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { clientId, result } = await req.json()
    const cleanClientId = String(clientId || '').trim()
    if (!cleanClientId || !result) {
      return new Response('clientId and result are required', { status: 400 })
    }

    const normalized = normalizeSalesProcessResult(result)
    const document = await (prisma as any).clientDocument.findFirst({
      where: { clientId: cleanClientId, documentId: DOCUMENT_ID },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })
    if (!document?.id) {
      return new Response('No sales process transcript found to save against.', { status: 404 })
    }

    await (prisma as any).clientDocument.update({
      where: { id: document.id },
      data: {
        aiDetectedType: 'sales_process_review',
        aiReviewStatus: 'complete',
        aiReviewSummary: JSON.stringify(normalized),
        aiReviewFlags: [],
        aiReviewedAt: new Date(),
      },
    })

    return NextResponse.json(normalized)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to save sales process review.'
    console.error('[sales-review/save]', error)
    return new Response(message, { status: 500 })
  }
}
