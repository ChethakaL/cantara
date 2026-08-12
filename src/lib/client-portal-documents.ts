import type { DocumentDef } from './documentData'
import type { DocumentStatus } from './store'

/**
 * Documents Cantara collects or produces internally — hidden from client Assign / Document Upload.
 * - sales_process_transcript / meeting_notes: discovery & advisor call notes (Sales Process / Meeting Notes agents)
 * - customer_count: not linked to any agent documentIds; revenue agents use revenue_breakdown + pricing_schedule
 * - litigation_search_docs / online_reviews: sourced or handled by Cantara rather than requested from the client
 */
export const CLIENT_PORTAL_HIDDEN_DOC_IDS = new Set([
  'sales_process_transcript',
  'meeting_notes',
  'customer_count',
  'litigation_search_docs',
  'online_reviews',
])

export const MULTI_YEAR_UPLOAD_SLOTS: Record<string, string[]> = {
  tax_returns_3yr: ['Most recent tax year', 'Prior tax year', 'Two tax years ago'],
  accountant_statements: ['Most recent fiscal year', 'Prior fiscal year', 'Two fiscal years ago'],
}

export const DOCUMENT_REFERENCE_TEMPLATES: Partial<Record<string, { label: string; path: string }>> = {
  employee_list: {
    label: 'Download employee list template (Excel)',
    path: '/api/client-portal/templates/employee-list',
  },
  occupancy_review: {
    label: 'Download sample template (CSV) — please replace with 24 months of your data',
    path: '/PawPartner_hyline_hotel_everson_wa_occupancy_alls_export_20260722_100237.csv',
  },
}

export const DOCUMENT_ASSIGN_HELP: Partial<Record<string, string>> = {
  employee_list:
    'A spreadsheet listing each employee with job title, average weekly hours, and compensation (no SSNs). Use the template if helpful.',
  leases: 'Include the base lease and every amendment, addendum, or rider.',
  real_estate_appraisal: 'Upload one current appraisal document for the real estate owned by the business.',
  material_contracts: 'Vendor, supplier, software, and service agreements exceeding $5,000/year or longer than 12 months. If there is no formal agreement, upload a spreadsheet with the agreement details.',
}

export function isClientPortalDocument(doc: { id: string }): boolean {
  return !CLIENT_PORTAL_HIDDEN_DOC_IDS.has(doc.id)
}

export function filterClientPortalDocuments<T extends { id: string }>(docs: T[]): T[] {
  return docs.filter(isClientPortalDocument)
}

export function getMultiYearSlotIds(docId: string): string[] | null {
  const slots = MULTI_YEAR_UPLOAD_SLOTS[docId]
  if (!slots) return null
  return slots.map((_, index) => `${docId}__year_${index + 1}`)
}

export function getMultiYearCombinedId(docId: string) {
  return `${docId}__combined`
}

export function isMultiYearParentDocId(docId: string): boolean {
  return Boolean(MULTI_YEAR_UPLOAD_SLOTS[docId])
}

/** Status lookup may return undefined when a slot has no ClientDocumentStatus row yet. */
export type DocumentStatusLookup = (id: string) => DocumentStatus | undefined

function fileNameForSlot(getStatus: DocumentStatusLookup, id: string): string | null {
  return getStatus(id)?.fileName ?? null
}

/** Legacy uploads used the parent id (e.g. accountant_statements) before per-year / combined slots existed. */
export function resolveMultiYearLegacyFileName(
  docId: string,
  getStatus: DocumentStatusLookup,
): string | null {
  if (!isMultiYearParentDocId(docId)) return null
  return fileNameForSlot(getStatus, docId)
}

export function resolveMultiYearCombinedFileName(
  docId: string,
  getStatus: DocumentStatusLookup,
): string | null {
  const combined = fileNameForSlot(getStatus, getMultiYearCombinedId(docId))
  if (combined) return combined
  return resolveMultiYearLegacyFileName(docId, getStatus)
}

export type MultiYearUploadMode = 'empty' | 'combined' | 'per-year' | 'mixed'

export function getMultiYearUploadProgress(
  docId: string,
  getStatus: DocumentStatusLookup,
): {
  total: number
  completed: number
  mode: MultiYearUploadMode
  combinedFileName: string | null
  perYearCompleted: number
} {
  const slotIds = getMultiYearSlotIds(docId) ?? []
  const total = slotIds.length
  const combinedFileName = resolveMultiYearCombinedFileName(docId, getStatus)
  const perYearCompleted = slotIds.filter(slotId => Boolean(fileNameForSlot(getStatus, slotId))).length

  if (combinedFileName) {
    return {
      total,
      completed: total,
      mode: perYearCompleted > 0 ? 'mixed' : 'combined',
      combinedFileName,
      perYearCompleted,
    }
  }

  if (perYearCompleted === 0) {
    return { total, completed: 0, mode: 'empty', combinedFileName: null, perYearCompleted: 0 }
  }

  return {
    total,
    completed: perYearCompleted,
    mode: 'per-year',
    combinedFileName: null,
    perYearCompleted,
  }
}

export function clientDocumentAppliesToProgress(doc: DocumentDef, status: DocumentStatus): boolean {
  if (status.notApplicable || status.hasDoc === false) return false
  if (doc.type === 'required') return true
  return status.hasDoc === true || Boolean(status.fileName)
}

export function progressUnitsForDocument(
  doc: DocumentDef,
  status: DocumentStatus,
  getStatus: (id: string) => DocumentStatus,
): number {
  if (!clientDocumentAppliesToProgress(doc, status)) return 0
  const slotIds = getMultiYearSlotIds(doc.id)
  if (slotIds) return slotIds.length
  return 1
}

export function completedUnitsForDocument(
  doc: DocumentDef,
  status: DocumentStatus,
  getStatus: (id: string) => DocumentStatus,
): number {
  if (!clientDocumentAppliesToProgress(doc, status)) return 0
  if (MULTI_YEAR_UPLOAD_SLOTS[doc.id]) {
    return getMultiYearUploadProgress(doc.id, getStatus).completed
  }
  return status.fileName ? 1 : 0
}

export function summarizeClientPortalProgress(
  docs: DocumentDef[],
  getStatus: (id: string) => DocumentStatus,
): { completed: number; total: number } {
  let completed = 0
  let total = 0
  for (const doc of docs) {
    const status = getStatus(doc.id)
    const units = progressUnitsForDocument(doc, status, getStatus)
    if (units === 0) continue
    total += units
    completed += completedUnitsForDocument(doc, status, getStatus)
  }
  return { completed, total }
}
