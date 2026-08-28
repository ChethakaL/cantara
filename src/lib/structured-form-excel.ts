import * as XLSX from 'xlsx'

export type StructuredFormFieldKey = 'professionalAdvisorsList' | 'vendorDirectoryList'

export const STRUCTURED_FORM_FIELD_KEYS: StructuredFormFieldKey[] = [
  'professionalAdvisorsList',
  'vendorDirectoryList',
]

export const STRUCTURED_FORM_COLUMNS: Record<
  StructuredFormFieldKey,
  Array<{ key: string; label: string; placeholder?: string }>
> = {
  professionalAdvisorsList: [
    { key: 'role', label: 'Role', placeholder: 'Accountant' },
    { key: 'name', label: 'Name', placeholder: 'Rex John' },
    { key: 'company', label: 'Company', placeholder: 'Rex Dog Hotel' },
    { key: 'email', label: 'Email', placeholder: 'email@example.com' },
    { key: 'phone', label: 'Phone', placeholder: '555-123-4567' },
    { key: 'notes', label: 'Notes', placeholder: 'Context' },
  ],
  vendorDirectoryList: [
    { key: 'name', label: 'Tool name', placeholder: 'Gingr' },
    { key: 'vendor', label: 'Vendor', placeholder: 'Gingr' },
    { key: 'category', label: 'Category', placeholder: 'Booking/POS' },
    { key: 'annualCost', label: 'Annual cost', placeholder: '3600' },
    { key: 'contractStatus', label: 'Contract status', placeholder: 'Active' },
    { key: 'transferable', label: 'Transferable', placeholder: 'yes/no/unknown' },
    { key: 'loginAccess', label: 'Login access', placeholder: 'Owner Only' },
    { key: 'notes', label: 'Notes', placeholder: 'Context' },
  ],
}

export function isStructuredFormFieldKey(fieldKey: string): fieldKey is StructuredFormFieldKey {
  return STRUCTURED_FORM_FIELD_KEYS.includes(fieldKey as StructuredFormFieldKey)
}

export function getStructuredFormTemplateFilename(fieldKey: StructuredFormFieldKey): string {
  if (fieldKey === 'professionalAdvisorsList') return 'Cantara Professional Advisors Template.xlsx'
  return 'Cantara Software & Vendors Template.xlsx'
}

const PIPE_DELIMITER = ' | '

function splitPipeLine(line: string): string[] {
  if (line.includes(PIPE_DELIMITER)) {
    return line.split(PIPE_DELIMITER)
  }
  // Legacy rows used bare pipes with trimmed cells.
  return line.split('|').map(part => part.trim())
}

export function parsePipeRows(value: string, fieldKey: StructuredFormFieldKey): Record<string, string>[] {
  const columns = STRUCTURED_FORM_COLUMNS[fieldKey]
  return String(value || '')
    .replace(/\\n/g, '\n')
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => {
      const parts = splitPipeLine(line)
      return columns.reduce<Record<string, string>>((row, column, index) => {
        row[column.key] = parts[index] ?? ''
        return row
      }, {})
    })
    .filter(row => !isLabelEchoRecord(row, fieldKey))
}

export function serializePipeRows(rows: Record<string, string>[], fieldKey: StructuredFormFieldKey): string {
  const columns = STRUCTURED_FORM_COLUMNS[fieldKey]
  return rows.map(row => columns.map(column => row[column.key] ?? '').join(PIPE_DELIMITER)).join('\n')
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function getAllStructuredColumnLabels(): Set<string> {
  return new Set(
    STRUCTURED_FORM_FIELD_KEYS.flatMap(key =>
      STRUCTURED_FORM_COLUMNS[key].map(column => normalizeHeader(column.label)),
    ),
  )
}

function scoreHeaderRow(row: unknown[], fieldKey: StructuredFormFieldKey): number {
  const columns = STRUCTURED_FORM_COLUMNS[fieldKey]
  const allLabels = getAllStructuredColumnLabels()
  const cells = (row ?? []).map(cell => normalizeHeader(cell)).filter(Boolean)
  if (cells.length < 2) return 0

  let currentMatches = 0
  let anyLabelMatches = 0
  for (const cell of cells) {
    if (columns.some(column => normalizeHeader(column.label) === cell)) currentMatches++
    if (allLabels.has(cell)) anyLabelMatches++
  }

  return currentMatches * 3 + anyLabelMatches
}

function findHeaderRowIndex(matrix: unknown[][], fieldKey: StructuredFormFieldKey): number {
  const scanThrough = Math.min(6, matrix.length)
  let bestIndex = -1
  let bestScore = 0

  for (let index = 0; index < scanThrough; index++) {
    const score = scoreHeaderRow(matrix[index] ?? [], fieldKey)
    if (score > bestScore && score >= 2) {
      bestScore = score
      bestIndex = index
    }
  }

  return bestIndex
}

function isLabelEchoRecord(record: Record<string, string>, fieldKey: StructuredFormFieldKey): boolean {
  const columns = STRUCTURED_FORM_COLUMNS[fieldKey]
  const allLabels = getAllStructuredColumnLabels()
  const values = columns.map(column => normalizeHeader(record[column.key] ?? '')).filter(Boolean)
  if (values.length < 2) return false

  const labelMatches = values.filter(value => allLabels.has(value)).length
  return labelMatches >= Math.min(2, values.length)
}

function wrongTemplateForField(headerRow: unknown[], fieldKey: StructuredFormFieldKey): boolean {
  const otherKey: StructuredFormFieldKey =
    fieldKey === 'professionalAdvisorsList' ? 'vendorDirectoryList' : 'professionalAdvisorsList'
  const currentScore = scoreHeaderRow(headerRow, fieldKey)
  const otherScore = scoreHeaderRow(headerRow, otherKey)
  return otherScore > currentScore + 1
}

function triggerBrowserDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function downloadStructuredFormTemplate(fieldKey: StructuredFormFieldKey) {
  const columns = STRUCTURED_FORM_COLUMNS[fieldKey]
  const headers = columns.map(column => column.label)
  const exampleRow = columns.map(column => column.placeholder ?? '')
  const worksheet = XLSX.utils.aoa_to_sheet([headers, exampleRow])
  worksheet['!cols'] = columns.map(column => ({ wch: Math.max(14, column.label.length + 2) }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  triggerBrowserDownload(buffer, getStructuredFormTemplateFilename(fieldKey))
}

export function parseStructuredFormExcel(buffer: ArrayBuffer, fieldKey: StructuredFormFieldKey): string {
  const columns = STRUCTURED_FORM_COLUMNS[fieldKey]
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('The spreadsheet has no sheets.')

  const sheet = workbook.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
  if (!matrix.length) throw new Error('The spreadsheet is empty.')

  const headerRowIndex = findHeaderRowIndex(matrix, fieldKey)
  const hasHeaderRow = headerRowIndex >= 0
  const headerRow = hasHeaderRow ? (matrix[headerRowIndex] ?? []) : []

  if (hasHeaderRow && wrongTemplateForField(headerRow, fieldKey)) {
    const expected =
      fieldKey === 'professionalAdvisorsList' ? 'Professional Advisors' : 'Software & Vendors'
    throw new Error(
      `This spreadsheet looks like the wrong template. Use the ${expected} Excel template for this section.`,
    )
  }

  const labelToKey = Object.fromEntries(columns.map(column => [normalizeHeader(column.label), column.key]))
  const headerCells = headerRow.map(cell => normalizeHeader(cell))

  const columnIndexByKey: Record<string, number> = {}
  if (hasHeaderRow) {
    headerCells.forEach((label, index) => {
      const key = labelToKey[label]
      if (key) columnIndexByKey[key] = index
    })
  } else {
    columns.forEach((column, index) => {
      columnIndexByKey[column.key] = index
    })
  }

  const dataRows = (hasHeaderRow ? matrix.slice(headerRowIndex + 1) : matrix).filter(row =>
    row.some(cell => String(cell ?? '').trim()),
  )

  const parsedRows = dataRows
    .map(row => {
      if (hasHeaderRow && scoreHeaderRow(row, fieldKey) >= 2) return null
      const record: Record<string, string> = {}
      columns.forEach(column => {
        const index = columnIndexByKey[column.key] ?? columns.findIndex(item => item.key === column.key)
        record[column.key] = String(row[index] ?? '').trim()
      })
      return record
    })
    .filter((row): row is Record<string, string> => Boolean(row))
    .filter(row => columns.some(column => row[column.key]))
    .filter(row => !isLabelEchoRecord(row, fieldKey))

  if (!parsedRows.length) {
    throw new Error('No data rows found. Add at least one row under the header line.')
  }

  return serializePipeRows(parsedRows, fieldKey)
}
