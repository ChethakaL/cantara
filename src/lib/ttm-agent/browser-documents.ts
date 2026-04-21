'use client'

import * as XLSX from 'xlsx'
import type { PreparedDocumentInput, PreparedDocumentTextBlock, Ws2DocumentId } from '@/lib/ttm-agent/types'

function normalizeMimeType(fileName: string, mimeType: string) {
  if (mimeType) return mimeType
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel'
  if (lower.endsWith('.csv')) return 'text/csv'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  return 'application/octet-stream'
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    let chunkText = ''
    for (let inner = 0; inner < chunk.length; inner += 1) {
      chunkText += String.fromCharCode(chunk[inner])
    }
    binary += chunkText
  }

  return btoa(binary)
}

/**
 * V3 Section 4.3 — convertMultiSheetExcelToText
 *
 * Converts a multi-sheet Excel workbook (P&L or BS with 3 fiscal year sheets)
 * to a single concatenated CSV text block exactly per the V3 spec:
 * 1. Reads each sheet
 * 2. Strips the annual total column (last column if sheet has >= 15 cols)
 * 3. Converts to CSV
 * 4. Concatenates with === SHEET: [name] === separators
 * 5. Adds metadata headers per V3 spec
 */
function convertMultiSheetExcelToText(buffer: ArrayBuffer, fileLabel: string): string {
  const workbook = XLSX.read(buffer, { type: 'array' })

  const sheetTexts = workbook.SheetNames.map((name) => {
    const ws = workbook.Sheets[name]

    // Get the sheet range to identify and strip the annual total column
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    const lastCol = range.e.c

    // Convert to array of arrays so we can strip the last column
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
      header: 1,
      defval: '',
    })
    const stripped = rows.map((row) => {
      // Keep all columns except the last one (annual total column)
      // Only strip if the sheet has more than 14 columns (GL + Name + 12 months + total = 15)
      const rowArr = row as (string | number | null)[]
      if (rowArr.length >= 15) return rowArr.slice(0, 14)
      return rowArr
    })

    // Convert back to CSV
    const csvText = stripped
      .map((row) =>
        (row as (string | number | null)[])
          .map((cell) => {
            const s = String(cell ?? '')
            return s.includes(',') ? `"${s}"` : s
          })
          .join(','),
      )
      .join('\n')

    return `=== SHEET: ${name} ===\n${csvText}`
  })

  // Concatenate all sheets with clear separators per V3 spec
  const fullText =
    `=== INPUT FILE: ${fileLabel} ===\n` +
    `=== STRUCTURE: ${workbook.SheetNames.length} sheets covering 36 months (12 months per sheet) ===\n` +
    `=== COLUMNS: GL Code | Account Name | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec ===\n` +
    `=== NOTE: Annual total column has been removed. Use the 12 monthly columns only. ===\n\n` +
    sheetTexts.join('\n\n=== END OF SHEET — NEXT FISCAL YEAR BELOW ===\n\n')

  return fullText
}

/**
 * V3 Section 4.3 — convertSingleSheetExcelToText
 *
 * Converts a single-sheet Excel file (Accountant Statements, Add-Back Disclosure).
 */
function convertSingleSheetExcelToText(buffer: ArrayBuffer, fileLabel: string): string {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
  const csvText = XLSX.utils.sheet_to_csv(firstSheet)
  return `=== INPUT FILE: ${fileLabel} ===\n${csvText}`
}

/**
 * Legacy fallback: workbook to text blocks (for formats that don't match multi-sheet P&L/BS)
 */
function workbookToTextBlocks(buffer: ArrayBuffer): PreparedDocumentTextBlock[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  return workbook.SheetNames.map((sheetName) => ({
    sheetName,
    text: XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]),
  }))
}

/**
 * V3 Section 4.3 — File label mapping
 */
const FILE_LABELS: Record<string, string> = {
  monthly_pl_excel: 'Monthly P&L — 3 Fiscal Years',
  monthly_bs_excel: 'Monthly Balance Sheet — 3 Fiscal Years',
  accountant_statements: 'Accountant-Prepared Financial Statements — 3 Fiscal Years',
  addback_disclosure: 'Seller Add-Back Disclosure (Items 2.1–2.5 and 3.2)',
  owner_gm_assessment: 'Owner & GM Assessment Output',
}

/**
 * V3 multi-sheet financial documents: P&L and BS use convertMultiSheetExcelToText
 */
const MULTI_SHEET_DOCUMENT_IDS = ['monthly_pl_excel', 'monthly_bs_excel']

/**
 * V3 single-sheet financial documents: all others
 */
const SINGLE_SHEET_DOCUMENT_IDS = ['accountant_statements', 'addback_disclosure', 'owner_gm_assessment']

export async function prepareWs2DocumentFromServer(args: {
  clientId: string
  documentId: Ws2DocumentId
  fileName: string
}) {
  const res = await fetch(`/api/client-documents/raw?clientId=${args.clientId}&documentId=${args.documentId}`)
  if (!res.ok) {
    throw new Error(await res.text().catch(() => `Failed to load ${args.fileName}`))
  }

  const buffer = await res.arrayBuffer()
  const mimeType = normalizeMimeType(args.fileName, res.headers.get('content-type') || '')
  const lower = args.fileName.toLowerCase()

  const prepared: PreparedDocumentInput = {
    documentId: args.documentId,
    fileName: args.fileName,
    mimeType,
    size: buffer.byteLength,
  }

  const isExcel =
    mimeType.includes('spreadsheet') || mimeType.includes('excel') || lower.endsWith('.xlsx') || lower.endsWith('.xls')

  // V3 Section 4.3: Multi-sheet P&L and BS use the exact V3 conversion with column stripping
  if (isExcel && MULTI_SHEET_DOCUMENT_IDS.includes(args.documentId)) {
    const fileLabel = FILE_LABELS[args.documentId] || args.fileName
    const fullText = convertMultiSheetExcelToText(buffer, fileLabel)
    prepared.textBlocks = [
      {
        sheetName: 'ConcatenatedMultiSheet',
        text: fullText,
      },
    ]
    return prepared
  }

  // V3 Section 4.3: Single-sheet documents (accountant, add-back disclosure)
  if (isExcel && SINGLE_SHEET_DOCUMENT_IDS.includes(args.documentId)) {
    const fileLabel = FILE_LABELS[args.documentId] || args.fileName
    const fullText = convertSingleSheetExcelToText(buffer, fileLabel)
    prepared.textBlocks = [
      {
        sheetName: 'Sheet1',
        text: fullText,
      },
    ]
    return prepared
  }

  // Generic Excel: keep as separate sheet blocks
  if (isExcel) {
    prepared.textBlocks = workbookToTextBlocks(buffer)
    return prepared
  }

  if (mimeType.includes('csv') || lower.endsWith('.csv') || lower.endsWith('.txt')) {
    const fileLabel = FILE_LABELS[args.documentId] || args.fileName
    prepared.textBlocks = [
      {
        sheetName: 'Sheet1',
        text: `=== INPUT FILE: ${fileLabel} ===\n${new TextDecoder().decode(buffer)}`,
      },
    ]
    return prepared
  }

  if (mimeType.includes('pdf') || lower.endsWith('.pdf')) {
    prepared.base64 = arrayBufferToBase64(buffer)
    return prepared
  }

  prepared.textBlocks = [
    {
      sheetName: 'Sheet1',
      text: new TextDecoder().decode(buffer),
    },
  ]

  return prepared
}
