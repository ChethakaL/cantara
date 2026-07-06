import { buildDocumentUploadStatusSummary } from '@/lib/client-document-upload'
import { getMultiYearCombinedId, isMultiYearParentDocId } from '@/lib/client-portal-documents'

export function multiYearStatusMirrorIds(documentId: string): string[] {
  const mirrors = new Set<string>()
  if (isMultiYearParentDocId(documentId)) {
    mirrors.add(getMultiYearCombinedId(documentId))
  }
  if (documentId.endsWith('__combined')) {
    mirrors.add(documentId.replace(/__combined$/, ''))
  }
  mirrors.delete(documentId)
  return Array.from(mirrors)
}

export async function syncDocumentStatusForUpload(
  tx: any,
  clientId: string,
  documentId: string,
) {
  const rows = await tx.clientDocument.findMany({
    where: { clientId, documentId },
    orderBy: { createdAt: 'desc' },
    select: {
      fileName: true,
      googleDriveFileId: true,
      createdAt: true,
    },
  })

  const summary = buildDocumentUploadStatusSummary(
    rows.map((row: any, index: number) => ({
      id: String(index),
      fileName: row.fileName,
      uploadedAt: row.createdAt.toISOString(),
      fileUrl: row.googleDriveFileId ?? null,
    })),
  )

  const statusUpdate = summary.fileCount
    ? {
        hasDoc: true,
        unavailableDecision: null,
        fileName: summary.fileName,
        fileUrl: summary.fileUrl,
        uploadedAt: summary.uploadedAt ? new Date(summary.uploadedAt) : new Date(),
        notApplicable: false,
      }
    : {
        hasDoc: null,
        unavailableDecision: null,
        fileName: null,
        fileUrl: null,
        uploadedAt: null,
        notApplicable: false,
      }

  const statusIds = [documentId, ...multiYearStatusMirrorIds(documentId)]
  for (const statusDocumentId of statusIds) {
    await tx.clientDocumentStatus.upsert({
      where: {
        clientId_documentId: {
          clientId,
          documentId: statusDocumentId,
        },
      },
      update: statusUpdate,
      create: {
        clientId,
        documentId: statusDocumentId,
        ...statusUpdate,
      },
    })
  }
}
