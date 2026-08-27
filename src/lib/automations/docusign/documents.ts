import { executeDocuSignTool } from '@/lib/composio/docusign'

export function extractPdfBytesFromToolResult(toolResult: any): Buffer | null {
  const data = toolResult?.data ?? toolResult
  const candidates = [
    data?.documentBase64,
    data?.pdfBase64,
    data?.file_base64,
    data?.content,
    data?.data,
    data?.documents?.[0]?.PDFBytes,
    data?.documents?.[0]?.pdfBytes,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 32) {
      try {
        return Buffer.from(c.replace(/^data:application\/pdf;base64,/, ''), 'base64')
      } catch {
        /* continue */
      }
    }
  }
  if (typeof data === 'string' && data.length > 100) {
    try {
      return Buffer.from(data, 'base64')
    } catch {
      return null
    }
  }
  return null
}

/** Download a single envelope document (Make: Document ID 1). */
export async function downloadEnvelopeDocument(args: {
  accountId: string
  envelopeId: string
  documentId: string
  fileNamePrefix?: string
}): Promise<{ bytes: Buffer; fileName: string }> {
  const result = await executeDocuSignTool<any>('DOCUSIGN_RETRIEVE_ENVELOPE_DOCUMENTS', {
    accountId: args.accountId,
    envelopeId: args.envelopeId,
    documentId: args.documentId,
  })
  if (result?.successful === false) {
    throw new Error(
      typeof result.error === 'string' ? result.error : JSON.stringify(result.error || result.data)
    )
  }
  const bytes = extractPdfBytesFromToolResult(result)
  if (!bytes?.length) {
    throw new Error(
      'DocuSign document download returned no PDF bytes (check DOCUSIGN_RETRIEVE_ENVELOPE_DOCUMENTS response)'
    )
  }
  const prefix = args.fileNamePrefix || 'signed'
  return {
    bytes,
    fileName: `${prefix}-${args.envelopeId.slice(0, 8)}-doc${args.documentId}.pdf`,
  }
}
