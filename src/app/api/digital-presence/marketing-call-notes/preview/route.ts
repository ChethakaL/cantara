import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertS3Configured, s3BucketName, s3Client } from '@/lib/s3'
import { extractTranscriptText } from '@/lib/sales-review/analyze'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0)
  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
    return Buffer.from(await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray())
  }
  return Buffer.from(await new Response(body as BodyInit).arrayBuffer())
}

export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get('clientId')?.trim()
    const recordId = req.nextUrl.searchParams.get('recordId')?.trim()
    if (!clientId || !recordId) return new Response('clientId and recordId are required', { status: 400 })
    assertS3Configured()

    const document = await (prisma as any).clientDocument.findFirst({
      where: { id: recordId, clientId, documentId: 'marketing_call_notes' },
      select: { fileName: true, mimeType: true, localPath: true, storageBucket: true },
    })
    if (!document?.localPath) return new Response('Marketing call notes file not found', { status: 404 })

    const object = await s3Client.send(new GetObjectCommand({
      Bucket: document.storageBucket || s3BucketName,
      Key: document.localPath,
    }))
    const text = await extractTranscriptText(await bodyToBuffer(object.Body), document.mimeType || '', document.fileName || 'marketing-notes.txt')
    return NextResponse.json({ fileName: document.fileName, text })
  } catch (error) {
    console.error('[Marketing Agent] Call notes preview failed:', error)
    return new Response(error instanceof Error ? error.message : 'Could not preview marketing call notes', { status: 500 })
  }
}
