export type ClientUploadedFile = {
  id: string
  fileName: string
  uploadedAt: string
  fileUrl?: string | null
}

type UploadRuleKind =
  | 'pdf'
  | 'excel'
  | 'pdf_or_excel'
  | 'pdf_or_docx'
  | 'transcript'
  | 'spreadsheet'
  | 'pdf_or_image'
  | 'spreadsheet_or_pdf'

/** Parent document id after stripping multi-year slot suffixes. */
function normalizeDocumentSlotId(documentId: string): string {
  return documentId.replace(/__year_\d+$/, '').replace(/__combined$/, '')
}

const DOCUMENT_UPLOAD_RULES: Record<string, UploadRuleKind> = {
  monthly_pl_excel: 'excel',
  monthly_bs_excel: 'excel',
  accountant_statements: 'pdf_or_excel',
  insurance_claims_12m: 'pdf',
  insurance_policies: 'pdf',
  leases: 'pdf',
  material_contracts: 'pdf_or_excel',
  occupancy_review: 'spreadsheet',
  prior_offers: 'pdf_or_docx',
  sales_process_transcript: 'transcript',
  meeting_notes: 'transcript',
  real_estate_appraisal: 'pdf_or_image',
  tax_returns_3yr: 'pdf_or_image',
  irs_941_940_3yr: 'pdf_or_image',
  contractor_1099_agreements: 'pdf_or_image',
  sales_use_tax_3yr: 'pdf_or_image',
  irs_tax_notices_3yr: 'pdf_or_image',
  employee_list: 'excel',
  key_employee_contracts: 'pdf',
  revenue_breakdown: 'spreadsheet_or_pdf',
  pricing_schedule: 'spreadsheet_or_pdf',
  online_reviews: 'pdf_or_image',
  articles_org: 'pdf_or_image',
  shareholder_agreement: 'pdf_or_image',
  ownership_structure: 'pdf_or_image',
  business_licenses: 'pdf_or_image',
  zoning_approval: 'pdf_or_image',
  certificate_occupancy: 'pdf_or_image',
  building_permits: 'pdf_or_image',
  health_safety: 'pdf_or_image',
  violations: 'pdf_or_image',
  sales_tax_permit: 'pdf_or_image',
  litigation_search_docs: 'pdf_or_image',
  pending_litigation: 'pdf_or_image',
  bank_statements: 'pdf',
  accounts_payable: 'pdf_or_excel',
  loan_docs: 'pdf',
  org_chart: 'pdf_or_image',
  sop_manual: 'pdf_or_docx',
  intellectual_property: 'pdf_or_image',
  environmental_reports: 'pdf',
}

/** @deprecated Use validateDocumentUpload — kept for callers that only check PDF slots. */
export const PDF_ONLY_DOCUMENT_IDS = new Set(
  Object.entries(DOCUMENT_UPLOAD_RULES)
    .filter(([, rule]) => rule === 'pdf')
    .map(([id]) => id),
)

function getUploadRule(documentId: string): UploadRuleKind | null {
  const normalized = normalizeDocumentSlotId(documentId)
  return DOCUMENT_UPLOAD_RULES[normalized] ?? DOCUMENT_UPLOAD_RULES[documentId] ?? null
}

function fileExtension(name: string): string {
  const match = name.toLowerCase().match(/(\.[a-z0-9]+)$/)
  return match?.[1] ?? ''
}

function fileMime(file: Pick<File, 'name' | 'type'>): string {
  return (file.type || '').toLowerCase()
}

export function isPdfUpload(file: Pick<File, 'name' | 'type'>): boolean {
  const type = fileMime(file)
  const name = file.name.toLowerCase()
  return type === 'application/pdf' || name.endsWith('.pdf')
}

function isExcelUpload(file: Pick<File, 'name' | 'type'>): boolean {
  const type = fileMime(file)
  const ext = fileExtension(file.name)
  return (
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    type === 'application/vnd.ms-excel' ||
    type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    ext === '.xlsx' ||
    ext === '.xls'
  )
}

function isCsvUpload(file: Pick<File, 'name' | 'type'>): boolean {
  const type = fileMime(file)
  return type.includes('csv') || type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')
}

function isSpreadsheetUpload(file: Pick<File, 'name' | 'type'>): boolean {
  return isExcelUpload(file) || isCsvUpload(file)
}

function isImageUpload(file: Pick<File, 'name' | 'type'>): boolean {
  const type = fileMime(file)
  const ext = fileExtension(file.name)
  return (
    type.startsWith('image/') ||
    ext === '.png' ||
    ext === '.jpg' ||
    ext === '.jpeg' ||
    ext === '.webp' ||
    ext === '.gif'
  )
}

function isDocxUpload(file: Pick<File, 'name' | 'type'>): boolean {
  const type = fileMime(file)
  const name = file.name.toLowerCase()
  return (
    type.includes('wordprocessingml') ||
    type.includes('application/msword') ||
    name.endsWith('.docx') ||
    name.endsWith('.doc')
  )
}

function isTranscriptUpload(file: Pick<File, 'name' | 'type'>): boolean {
  const type = fileMime(file)
  const name = file.name.toLowerCase()
  return (
    isPdfUpload(file) ||
    isDocxUpload(file) ||
    type === 'text/plain' ||
    name.endsWith('.txt')
  )
}

const ACCEPT_BY_RULE: Record<UploadRuleKind, Record<string, string[]>> = {
  pdf: { 'application/pdf': ['.pdf'] },
  excel: {
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
  },
  pdf_or_excel: {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
  },
  pdf_or_docx: {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/msword': ['.doc'],
  },
  transcript: {
    'application/pdf': ['.pdf'],
    'text/plain': ['.txt'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/msword': ['.doc'],
  },
  spreadsheet: {
    'text/csv': ['.csv'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
  },
  pdf_or_image: {
    'application/pdf': ['.pdf'],
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/webp': ['.webp'],
  },
  spreadsheet_or_pdf: {
    'application/pdf': ['.pdf'],
    'text/csv': ['.csv'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'application/vnd.ms-excel': ['.xls'],
  },
}

const ALLOWED_LABEL_BY_RULE: Record<UploadRuleKind, string> = {
  pdf: 'PDF',
  excel: 'Excel (.xlsx or .xls)',
  pdf_or_excel: 'PDF or Excel',
  pdf_or_docx: 'PDF or Word (.docx)',
  transcript: 'PDF, Word, or plain text (.txt)',
  spreadsheet: 'CSV or Excel (.csv, .xlsx, .xls)',
  pdf_or_image: 'PDF or image (PNG, JPG)',
  spreadsheet_or_pdf: 'PDF, CSV, or Excel',
}

const HINT_BY_RULE: Record<UploadRuleKind, string> = {
  pdf: 'PDF files only.',
  excel: 'Excel files only (.xlsx or .xls).',
  pdf_or_excel: 'Upload a PDF or Excel file.',
  pdf_or_docx: 'Upload a PDF or Word document.',
  transcript: 'Upload a PDF, Word, or plain-text transcript.',
  spreadsheet: 'Upload a CSV or Excel spreadsheet with your occupancy data.',
  pdf_or_image: 'Upload a PDF or a clear photo/scan (PNG or JPG).',
  spreadsheet_or_pdf: 'Upload a PDF or spreadsheet (CSV/Excel).',
}

const DOCUMENT_HINT_OVERRIDES: Partial<Record<string, string>> = {
  insurance_claims_12m:
    'PDF files only. The Insurance Review Agent cannot process images or other file types.',
  monthly_pl_excel: 'Excel only (.xlsx or .xls). Required for the Valuation Agent.',
  monthly_bs_excel: 'Excel only (.xlsx or .xls). Required for the Valuation Agent.',
  leases: 'PDF only. Lease Analysis requires PDF lease documents.',
  material_contracts: 'Upload contract PDFs, or an Excel spreadsheet if there is no formal agreement.',
  occupancy_review:
    'CSV or Excel only. Download the sample CSV and replace it with 24 months of your data.',
  sales_process_transcript: 'PDF, Word, or plain text (.txt). Used by the Sales Process Review agent.',
}

function fileMatchesRule(file: Pick<File, 'name' | 'type'>, rule: UploadRuleKind): boolean {
  switch (rule) {
    case 'pdf':
      return isPdfUpload(file)
    case 'excel':
      return isExcelUpload(file)
    case 'pdf_or_excel':
      return isPdfUpload(file) || isExcelUpload(file)
    case 'pdf_or_docx':
      return isPdfUpload(file) || isDocxUpload(file)
    case 'transcript':
      return isTranscriptUpload(file)
    case 'spreadsheet':
      return isSpreadsheetUpload(file)
    case 'pdf_or_image':
      return isPdfUpload(file) || isImageUpload(file)
    case 'spreadsheet_or_pdf':
      return isPdfUpload(file) || isSpreadsheetUpload(file)
    default:
      return true
  }
}

/** @deprecated Use validateDocumentUpload. */
export function documentRequiresPdf(documentId: string): boolean {
  return getUploadRule(documentId) === 'pdf'
}

export function getDocumentUploadAccept(documentId: string): Record<string, string[]> | undefined {
  const rule = getUploadRule(documentId)
  if (!rule) return undefined
  return ACCEPT_BY_RULE[rule]
}

export function formatDocumentUploadAcceptAttribute(documentId: string): string | undefined {
  const accept = getDocumentUploadAccept(documentId)
  if (!accept) return undefined
  const parts = new Set<string>()
  for (const [mime, extensions] of Object.entries(accept)) {
    parts.add(mime)
    for (const ext of extensions) parts.add(ext)
  }
  return Array.from(parts).join(',')
}

export function validateDocumentUpload(documentId: string, file: Pick<File, 'name' | 'type'>): string | null {
  const rule = getUploadRule(documentId)
  if (!rule) return null
  if (fileMatchesRule(file, rule)) return null
  const allowed = ALLOWED_LABEL_BY_RULE[rule]
  return `"${file.name}" is not an accepted file type. Please upload ${allowed}.`
}

export function documentUploadFormatHint(documentId: string): string | null {
  const normalized = normalizeDocumentSlotId(documentId)
  if (DOCUMENT_HINT_OVERRIDES[normalized]) return DOCUMENT_HINT_OVERRIDES[normalized]!
  const rule = getUploadRule(documentId)
  if (!rule) return null
  return HINT_BY_RULE[rule]
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
