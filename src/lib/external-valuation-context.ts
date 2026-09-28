import { GetObjectCommand } from '@aws-sdk/client-s3'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { assertS3Configured, s3BucketName, s3Client } from '@/lib/s3'
import type { AgentMessageBlock } from '@/lib/llm-completion'

/** Resolve an explicitly selected client-uploaded report into provider-ready source blocks. */
export async function loadExternalValuationContext(clientId: string, reportId: string): Promise<{
  fileName: string
  blocks: AgentMessageBlock[]
}> {
  const report = await prisma.externalValuationReport.findFirst({
    where: { id: reportId, clientId },
    select: { fileName: true, mimeType: true, storageKey: true },
  })
  if (!report) throw new Error('The selected external valuation report is no longer available for this client.')
  assertS3Configured()
  const object = await s3Client.send(new GetObjectCommand({ Bucket: s3BucketName, Key: report.storageKey }))
  if (!object.Body) throw new Error('The selected external valuation report file is empty.')
  const bytes = Buffer.from(await object.Body.transformToByteArray())
  const ext = report.fileName.toLowerCase().split('.').pop()
  if (ext === 'pdf') {
    return {
      fileName: report.fileName,
      blocks: [{ type: 'document', title: report.fileName, source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') } }],
    }
  }
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    const workbook = ext === 'csv'
      ? XLSX.read(bytes.toString('utf8'), { type: 'string' })
      : XLSX.read(bytes, { type: 'buffer', cellFormula: true, cellText: true })
    const contents = workbook.SheetNames.map((name) => `\n--- Worksheet: ${name} ---\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name], { blankrows: false })}`).join('\n')
    if (!contents.trim()) throw new Error('The selected spreadsheet contains no readable worksheet data.')
    if (contents.length > 1_500_000) throw new Error('The selected spreadsheet is too large to include in one model run. Reduce its size or upload a focused valuation workbook.')
    return {
      fileName: report.fileName,
      blocks: [{ type: 'text', text: `The client-selected source is the uploaded workbook ${report.fileName}. The following is extracted directly from its worksheets; use this document as the valuation source and do not use the Cantara Valuation Agent output.\n${contents}` }],
    }
  }
  if (ext === 'docx') {
    const mammoth = await import('mammoth')
    const extracted = await mammoth.extractRawText({ buffer: bytes })
    const text = extracted.value.trim()
    if (!text) throw new Error('The selected Word report contains no readable text.')
    if (text.length > 1_500_000) throw new Error('The selected Word report is too large to include in one model run.')
    return {
      fileName: report.fileName,
      blocks: [{ type: 'text', text: `The client-selected source is the uploaded valuation report ${report.fileName}. Use this document as the valuation source and do not use the Cantara Valuation Agent output.\n${text}` }],
    }
  }
  throw new Error('Only uploaded PDF, Excel, CSV, and DOCX valuation reports can be selected as report inputs.')
}
