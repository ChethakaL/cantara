export type ClientUploadedFile = {
  id: string
  fileName: string
  uploadedAt: string
  fileUrl?: string | null
}

export function buildDocumentUploadStatusSummary(files: ClientUploadedFile[]): {
  fileName: string | null
  fileUrl: string | null
  uploadedAt: string | null
  fileCount: number
} {
  if (!files.length) {
    return { fileName: null, fileUrl: null, uploadedAt: null, fileCount: 0 }
  }
  const latest = files[0]
  return {
    fileName: files.length === 1 ? latest.fileName : `${files.length} files uploaded`,
    fileUrl: latest.fileUrl ?? null,
    uploadedAt: latest.uploadedAt,
    fileCount: files.length,
  }
}
