import type { ClientUploadedFile } from '@/lib/client-document-upload'

export type FilesByDocumentId = Record<string, ClientUploadedFile[]>

export async function fetchClientDocumentsBatch(clientId: string): Promise<FilesByDocumentId> {
  const res = await fetch(`/api/client-documents/batch?clientId=${encodeURIComponent(clientId)}`, {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  return (data.byDocumentId ?? {}) as FilesByDocumentId
}

export function mergeUploadedFiles(documentIds: string[], filesByDocId: FilesByDocumentId): ClientUploadedFile[] {
  const byId = new Map<string, ClientUploadedFile>()
  for (const documentId of documentIds) {
    for (const file of filesByDocId[documentId] ?? []) {
      byId.set(file.id, file)
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  )
}

export function fileCountForDocumentIds(documentIds: string[], filesByDocId: FilesByDocumentId): number {
  return mergeUploadedFiles(documentIds, filesByDocId).length
}
