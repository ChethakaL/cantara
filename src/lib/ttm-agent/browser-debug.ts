'use client'

type PreparedDocLike = {
  documentId: string
  fileName: string
  mimeType: string
  size: number
  textBlocks?: Array<{ sheetName: string; text: string }>
  base64?: string
}

function summarizePreparedDocuments(preparedDocuments: PreparedDocLike[]) {
  return preparedDocuments.map((doc) => ({
    documentId: doc.documentId,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    size: doc.size,
    textBlockCount: doc.textBlocks?.length ?? 0,
    textBlocks: (doc.textBlocks ?? []).map((block) => ({
      sheetName: block.sheetName,
      textLength: block.text.length,
      preview: block.text.slice(0, 180),
    })),
    hasBase64: Boolean(doc.base64),
    base64Length: doc.base64?.length ?? 0,
  }))
}

export function logWs2ClientEvent(label: string, payload?: unknown) {
  if (typeof window === 'undefined') return
  const timestamp = new Date().toISOString()
  console.groupCollapsed(`[WS2 UI] ${label} @ ${timestamp}`)
  if (payload !== undefined) {
    console.log(payload)
  }
  console.groupEnd()
}

export function logWs2PreparedDocuments(label: string, preparedDocuments: PreparedDocLike[]) {
  logWs2ClientEvent(label, summarizePreparedDocuments(preparedDocuments))
}

export async function logWs2Response(label: string, res: Response) {
  const clone = res.clone()
  let body: unknown = null

  try {
    const contentType = clone.headers.get('content-type') || ''
    body = contentType.includes('application/json') ? await clone.json() : await clone.text()
  } catch (error) {
    body = { parseError: error instanceof Error ? error.message : 'Unknown response parse error' }
  }

  logWs2ClientEvent(label, {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    url: res.url,
    body,
  })
}

export function logWs2Error(label: string, error: unknown, extra?: unknown) {
  if (typeof window === 'undefined') return
  console.groupCollapsed(`[WS2 UI] ${label} ERROR @ ${new Date().toISOString()}`)
  console.error(error)
  if (extra !== undefined) {
    console.log('extra', extra)
  }
  console.groupEnd()
}
