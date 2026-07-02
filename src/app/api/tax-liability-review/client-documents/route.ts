import { GetObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertS3Configured, s3BucketName, s3Client } from '@/lib/s3'
import { TAX_READINESS_DOCUMENT_GROUPS } from '@/lib/tax-readiness'
import { getMultiYearCombinedId, getMultiYearSlotIds } from '@/lib/client-portal-documents'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function bodyToBuffer(body: any) {
  if (!body) return Buffer.alloc(0)
  if (typeof body.transformToByteArray === 'function') {
    const bytes = await body.transformToByteArray()
    return Buffer.from(bytes)
  }
  const response = new Response(body)
  return Buffer.from(await response.arrayBuffer())
}

export async function GET(req: NextRequest) {
  try {
    assertS3Configured()

    const clientId = req.nextUrl.searchParams.get('clientId')
    const includeContent = req.nextUrl.searchParams.get('includeContent') === 'true'
    if (!clientId) return new Response('clientId is required', { status: 400 })

    const documentIds = TAX_READINESS_DOCUMENT_GROUPS.flatMap(group => {
      const multiYearSlotIds = getMultiYearSlotIds(group.id) ?? []
      return [group.id, getMultiYearCombinedId(group.id), ...multiYearSlotIds]
    })
    const rows = await (prisma as any).clientDocument.findMany({
      where: { clientId, documentId: { in: documentIds } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        documentId: true,
        fileName: true,
        mimeType: true,
        size: true,
        localPath: true,
        storageBucket: true,
        createdAt: true,
      },
    })

    const byDocumentId = new Map<string, any[]>()
    for (const row of rows) {
      const bucket = byDocumentId.get(row.documentId) ?? []
      bucket.push(row)
      byDocumentId.set(row.documentId, bucket)
    }

    const groups = TAX_READINESS_DOCUMENT_GROUPS.map(group => {
      const docs = [
        ...(byDocumentId.get(group.id) ?? []),
        ...(byDocumentId.get(getMultiYearCombinedId(group.id)) ?? []),
        ...(getMultiYearSlotIds(group.id) ?? []).flatMap(slotId => byDocumentId.get(slotId) ?? []),
      ]
      return {
        ...group,
        uploaded: docs.length > 0,
        documents: docs.map(doc => ({
          id: doc.id,
          documentId: doc.documentId,
          fileName: doc.fileName,
          mimeType: doc.mimeType || 'application/octet-stream',
          sizeBytes: doc.size ?? null,
          uploadedAt: doc.createdAt.toISOString(),
        })),
      }
    })

    const documents = includeContent
      ? await Promise.all(
          rows
            .filter((doc: any) => doc.localPath)
            .map(async (doc: any) => {
              const result = await s3Client.send(
                new GetObjectCommand({
                  Bucket: doc.storageBucket || s3BucketName,
                  Key: doc.localPath,
                }),
              )
              const bytes = await bodyToBuffer(result.Body)
              return {
                name: doc.fileName,
                base64: bytes.toString('base64'),
                mediaType: doc.mimeType || 'application/octet-stream',
                slotKey: doc.documentId,
                sizeBytes: doc.size ?? bytes.length,
              }
            }),
        )
      : []

    return NextResponse.json({
      groups,
      documents,
      requiredCount: TAX_READINESS_DOCUMENT_GROUPS.filter(group => group.required).length,
      uploadedRequiredCount: groups.filter(group => group.required && group.uploaded).length,
      missingRequired: groups.filter(group => group.required && !group.uploaded).map(group => group.id),
    })
  } catch (error) {
    console.error('[tax-liability-review/client-documents] Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
