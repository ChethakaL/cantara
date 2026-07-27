import type { MondayMapping } from '@/lib/sales-leads/monday-sync'

export const SALES_LEAD_MONDAY_MAPPING_FIELDS = [
  { key: 'assignedCaller', label: 'Assigned Caller' },
  { key: 'currentStage', label: 'Current Stage' },
  { key: 'lastCallResult', label: 'Last Action Result' },
  { key: 'nextActionDate', label: 'Next Action Date' },
  { key: 'lastContactDate', label: 'Last Contact Date' },
  { key: 'state', label: 'State' },
  { key: 'city', label: 'City' },
  { key: 'websiteUrl', label: 'Website URL' },
  { key: 'googleRating', label: 'Google Rating' },
  { key: 'reviewCount', label: 'Review Count' },
  { key: 'sqftIndoor', label: 'Square Footage (Indoor)' },
  { key: 'sqftOutdoor', label: 'Square Footage (Outdoor)' },
  { key: 'sqftCombined', label: 'Square Footage (Combined)' },
  { key: 'locationType', label: 'Location Type' },
  { key: 'preCallBriefUrl', label: 'Pre-Call Brief' },
  { key: 'ownerFirstName', label: 'Owner First Name' },
  { key: 'ownerLastName', label: 'Owner Last Name' },
  { key: 'ownerPhone', label: 'Owner Phone' },
  { key: 'sourceLinkPhone', label: 'Source Link (Phone)' },
  { key: 'ownerEmail', label: 'Owner Email' },
  { key: 'sourceLinkEmail', label: 'Source Link (Email)' },
  { key: 'bookingDateTime', label: 'Booking Date/Time' },
  { key: 'notes', label: 'Notes' },
] as const

export type SalesLeadMondayMappingKey = (typeof SALES_LEAD_MONDAY_MAPPING_FIELDS)[number]['key']
export type SalesLeadMondayMappingForm = Record<SalesLeadMondayMappingKey, string>

export function emptySalesLeadMondayMapping(): SalesLeadMondayMappingForm {
  return Object.fromEntries(
    SALES_LEAD_MONDAY_MAPPING_FIELDS.map(field => [field.key, '']),
  ) as SalesLeadMondayMappingForm
}

export function normalizeSalesLeadMondayMapping(input: unknown): MondayMapping {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  return Object.fromEntries(
    SALES_LEAD_MONDAY_MAPPING_FIELDS.map(field => {
      const value = source[field.key]
      return [field.key, typeof value === 'string' && value.trim() ? value.trim() : undefined]
    }).filter(([, value]) => value),
  ) as MondayMapping
}
