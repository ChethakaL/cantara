/** Client-side helpers to reuse Documents-tab uploads inside agent UIs. */

export type ClientUploadedDoc = {
  id: string
  fileName: string
  mimeType?: string | null
  uploadedAt?: string
  documentId: string
}

/**
 * List uploaded files for the given document slot IDs.
 * Uses the batch endpoint (one round-trip) instead of N per-document fetches.
 */
export async function listClientDocuments(
  clientId: string,
  documentIds: string[],
): Promise<ClientUploadedDoc[]> {
  if (documentIds.length === 0) return []

  const wanted = new Set(documentIds)
  const res = await fetch(
    `/api/client-documents/batch?clientId=${encodeURIComponent(clientId)}`,
    { cache: 'no-store' },
  )
  if (!res.ok) return []

  const data = await res.json()
  const byDocumentId = (data?.byDocumentId ?? {}) as Record<
    string,
    Array<{ id: string; fileName: string; mimeType?: string | null; uploadedAt?: string }>
  >

  const results: ClientUploadedDoc[] = []
  for (const documentId of documentIds) {
    if (!wanted.has(documentId)) continue
    const docs = byDocumentId[documentId] ?? []
    for (const doc of docs) {
      results.push({
        id: doc.id,
        fileName: doc.fileName,
        mimeType: doc.mimeType ?? null,
        uploadedAt: doc.uploadedAt,
        documentId,
      })
    }
  }
  return results
}

export async function fetchClientDocumentFile(args: {
  clientId: string
  documentId: string
  recordId: string
  fileName?: string
  mimeType?: string | null
}): Promise<File> {
  const params = new URLSearchParams({
    clientId: args.clientId,
    documentId: args.documentId,
    recordId: args.recordId,
  })
  const raw = await fetch(`/api/client-documents/raw?${params.toString()}`)
  if (!raw.ok) {
    throw new Error((await raw.text().catch(() => '')) || 'Failed to load uploaded document.')
  }
  const blob = await raw.blob()
  return new File(
    [blob],
    args.fileName || 'document',
    { type: args.mimeType || blob.type || 'application/octet-stream' },
  )
}

export async function fetchClientDocumentAsBase64(args: {
  clientId: string
  documentId: string
  recordId: string
  fileName?: string
  mimeType?: string | null
}): Promise<{ name: string; base64: string; mediaType: string; sizeBytes: number }> {
  const file = await fetchClientDocumentFile(args)
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      const comma = dataUrl.indexOf(',')
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl)
    }
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
    reader.readAsDataURL(file)
  })
  return {
    name: file.name,
    base64,
    mediaType: file.type || args.mimeType || 'application/octet-stream',
    sizeBytes: file.size,
  }
}

export function isPdfFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.pdf')
}

export function isSupportedEmployeeCompFile(fileName: string): boolean {
  return /\.(pdf|png|jpe?g|xlsx|xls|csv)$/i.test(fileName)
}
