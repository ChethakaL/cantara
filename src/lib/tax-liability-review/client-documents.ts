import { GetObjectCommand } from '@aws-sdk/client-s3'
import { prisma } from '@/lib/prisma'
import { assertS3Configured, s3BucketName, s3Client } from '@/lib/s3'
import { TAX_READINESS_DOCUMENT_GROUPS } from '@/lib/tax-readiness'
import { getMultiYearCombinedId, getMultiYearSlotIds } from '@/lib/client-portal-documents'

async function bodyToBuffer(body: any) {
  if (!body) return Buffer.alloc(0)
  if (typeof body.transformToByteArray === 'function') {
    const bytes = await body.transformToByteArray()
    return Buffer.from(bytes)
  }
  const response = new Response(body)
  return Buffer.from(await response.arrayBuffer())
}

export function taxReadinessDocumentIds() {
  return TAX_READINESS_DOCUMENT_GROUPS.flatMap((group) => {
    const multiYearSlotIds = getMultiYearSlotIds(group.id) ?? []
    return [group.id, getMultiYearCombinedId(group.id), ...multiYearSlotIds]
  })
}

export type TaxClientDocumentMeta = {
  id: string
  documentId: string
  fileName: string
  mimeType: string
  sizeBytes: number | null
  uploadedAt: string
  localPath: string | null
  storageBucket: string | null
}

export type TaxClientDocumentPayload = {
  name: string
  base64: string
  mediaType: string
  slotKey: string
  sizeBytes: number
}

export async function listTaxClientDocumentRows(clientId: string) {
  const documentIds = taxReadinessDocumentIds()
  return (prisma as any).clientDocument.findMany({
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
  }) as Promise<
    Array<{
      id: string
      documentId: string
      fileName: string
      mimeType: string | null
      size: number | null
      localPath: string | null
      storageBucket: string | null
      createdAt: Date
    }>
  >
}

export function buildTaxDocumentGroups(rows: Awaited<ReturnType<typeof listTaxClientDocumentRows>>) {
  const byDocumentId = new Map<string, typeof rows>()
  for (const row of rows) {
    const bucket = byDocumentId.get(row.documentId) ?? []
    bucket.push(row)
    byDocumentId.set(row.documentId, bucket)
  }

  return TAX_READINESS_DOCUMENT_GROUPS.map((group) => {
    const docs = [
      ...(byDocumentId.get(group.id) ?? []),
      ...(byDocumentId.get(getMultiYearCombinedId(group.id)) ?? []),
      ...(getMultiYearSlotIds(group.id) ?? []).flatMap((slotId) => byDocumentId.get(slotId) ?? []),
    ]
    return {
      ...group,
      uploaded: docs.length > 0,
      documents: docs.map((doc) => ({
        id: doc.id,
        documentId: doc.documentId,
        fileName: doc.fileName,
        mimeType: doc.mimeType || 'application/octet-stream',
        sizeBytes: doc.size ?? null,
        uploadedAt: doc.createdAt.toISOString(),
      })),
    }
  })
}

export async function loadTaxClientDocumentsWithContent(clientId: string): Promise<TaxClientDocumentPayload[]> {
  assertS3Configured()
  const rows = await listTaxClientDocumentRows(clientId)
  const withPath = rows.filter((doc) => doc.localPath)
  return Promise.all(
    withPath.map(async (doc) => {
      const result = await s3Client.send(
        new GetObjectCommand({
          Bucket: doc.storageBucket || s3BucketName,
          Key: doc.localPath!,
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
}
