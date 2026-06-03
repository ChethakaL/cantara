import { prisma } from '@/lib/prisma'
import type { ClientUploadedFile } from '@/lib/client-document-upload'

export type ClientDocumentRecord = {
  id: string
  documentId: string
  fileName: string
  mimeType: string
  localPath: string
  storageBucket: string | null
  googleDriveFileId: string | null
  createdAt: Date
  aiReviewSummary?: string | null
  aiReviewStatus?: string | null
  aiDetectedType?: string | null
  aiReviewFlags?: string[]
}

/** All stored files for one portal document slot (newest first). */
export async function listClientDocumentRecords(
  clientId: string,
  documentId: string,
  limit = 50,
): Promise<ClientDocumentRecord[]> {
  return (prisma as any).clientDocument.findMany({
    where: { clientId, documentId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      documentId: true,
      fileName: true,
      mimeType: true,
      localPath: true,
      storageBucket: true,
      googleDriveFileId: true,
      createdAt: true,
      aiReviewSummary: true,
      aiReviewStatus: true,
      aiDetectedType: true,
      aiReviewFlags: true,
    },
  })
}

export function toClientUploadedFiles(rows: Array<{ id: string; fileName: string; createdAt: Date; googleDriveFileId?: string | null }>): ClientUploadedFile[] {
  return rows.map(row => ({
    id: row.id,
    fileName: row.fileName,
    uploadedAt: row.createdAt.toISOString(),
    fileUrl: row.googleDriveFileId ?? null,
  }))
}
