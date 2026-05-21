import type { DocumentStatus } from '@/lib/store'

export const VALUATION_SECTION_ID = 'valuation'

export type SectionDeadlines = Record<string, string>

export function getEffectiveDocumentDeadline(
  documentId: string,
  sectionId: string,
  documentStatuses: Record<string, DocumentStatus>,
  sectionDeadlines: SectionDeadlines = {},
): string | null {
  const docDeadline = documentStatuses[documentId]?.targetDeadline
  if (docDeadline) return docDeadline
  return sectionDeadlines[sectionId] ?? null
}

export function formatDeadlineLabel(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function getDeadlineStatus(iso: string | null | undefined, hasUploaded: boolean): 'none' | 'upcoming' | 'due-soon' | 'overdue' | 'done' {
  if (!iso || hasUploaded) return hasUploaded ? 'done' : 'none'
  const due = new Date(iso)
  if (Number.isNaN(due.getTime())) return 'none'
  const now = new Date()
  const msPerDay = 24 * 60 * 60 * 1000
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / msPerDay)
  if (daysLeft < 0) return 'overdue'
  if (daysLeft <= 7) return 'due-soon'
  return 'upcoming'
}

export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export function fromDateInputValue(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const date = new Date(`${trimmed}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}
