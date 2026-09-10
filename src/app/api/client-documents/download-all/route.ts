import { GetObjectCommand } from '@aws-sdk/client-s3'
import JSZip from 'jszip'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertS3Configured, s3BucketName, s3Client } from '@/lib/s3'
import { buildDocumentLookup, sanitizePathPart } from '@/lib/client-document-paths'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function uniqueZipPath(used: Set<string>, path: string): string {
  if (!used.has(path)) {
    used.add(path)
    return path
  }
  const dot = path.lastIndexOf('.')
  const base = dot > 0 ? path.slice(0, dot) : path
  const ext = dot > 0 ? path.slice(dot) : ''
  let i = 2
  while (used.has(`${base} (${i})${ext}`)) i += 1
  const next = `${base} (${i})${ext}`
  used.add(next)
  return next
}

async function bodyToBuffer(body: unknown): Promise<Buffer> {
  if (!body) return Buffer.alloc(0)
  if (typeof (body as { transformToByteArray?: () => Promise<Uint8Array> }).transformToByteArray === 'function') {
    const bytes = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray()
    return Buffer.from(bytes)
  }
  return Buffer.from(await new Response(body as BodyInit).arrayBuffer())
}

export async function GET(req: NextRequest) {
  try {
    assertS3Configured()

    const clientId = req.nextUrl.searchParams.get('clientId')
    if (!clientId) {
      return new Response('clientId is required', { status: 400 })
    }

    const client = await (prisma as any).clientProfile.findUnique({
      where: { id: clientId },
      select: { businessName: true },
    })
    if (!client) {
      return new Response('Client not found', { status: 404 })
    }

    const documents = await (prisma as any).clientDocument.findMany({
      where: { clientId },
      orderBy: [{ documentId: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        documentId: true,
        fileName: true,
        localPath: true,
        storageBucket: true,
      },
    })

    if (!documents.length) {
      return new Response('No uploaded documents found for this client.', { status: 404 })
    }

    const lookup = buildDocumentLookup()
    const usedPaths = new Set<string>()
    const failed: string[] = []
    const zip = new JSZip()

    for (const doc of documents) {
      if (!doc.localPath) {
        failed.push(`${doc.fileName || doc.id} (missing storage path)`)
        continue
      }
      try {
        const result = await s3Client.send(
          new GetObjectCommand({
            Bucket: doc.storageBucket || s3BucketName,
            Key: doc.localPath,
          }),
        )
        const bytes = await bodyToBuffer(result.Body)
        const meta = doc.documentId ? lookup.get(doc.documentId) : undefined
        const category = sanitizePathPart(meta?.categoryTitle || 'Other')
        const checklistItem = sanitizePathPart(meta?.documentName || doc.documentId || 'Uncategorized')
        const fileName = sanitizePathPart(doc.fileName || `${doc.id}.bin`)
        const zipPath = uniqueZipPath(usedPaths, `${category}/${checklistItem}/${fileName}`)
        zip.file(zipPath, bytes)
      } catch (err) {
        console.error('[download-all] failed to fetch', doc.id, err)
        failed.push(doc.fileName || doc.id)
      }
    }

    if (failed.length) {
      zip.file(
        '_download-errors.txt',
        [
          'Some files could not be included in this download:',
          ...failed.map((name) => `- ${name}`),
          '',
        ].join('\n'),
      )
    }

    if (Object.keys(zip.files).length === 0) {
      return new Response('No document files could be downloaded.', { status: 404 })
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 5 },
    })

    const businessSlug = sanitizePathPart(client.businessName || 'client')
    const zipFileName = `${businessSlug}-documents.zip`

    return new Response(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(zipFileName)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[client-documents/download-all] Error:', error)
    return new Response(
      error instanceof Error ? error.message : 'Internal Server Error',
      { status: 500 },
    )
  }
}
