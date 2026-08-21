import type { MondayMapping } from '@/lib/sales-leads/monday-sync'

export const SALES_LEAD_MONDAY_MAPPING_FIELDS = [
  { key: 'businessName', label: 'Business Name (Item Name)' },
  { key: 'assignedCaller', label: 'Assigned Lead' },
  { key: 'currentStage', label: 'Current Stage' },
  { key: 'lastCallResult', label: 'Last Stage Result' },
  { key: 'nextActionDate', label: 'Next Stage Date' },
  { key: 'stageStartDate', label: 'Stage Start Date' },
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
  { key: 'email1Draft', label: 'Email 1 Draft' },
  { key: 'call1Script', label: 'Call 1 Script' },
  { key: 'email2Draft', label: 'Email 2 Draft' },
  { key: 'call2Script', label: 'Call 2 Script' },
  { key: 'ownerFirstName', label: 'Owner First Name' },
  { key: 'ownerLastName', label: 'Owner Last Name' },
  { key: 'ownerPhone', label: 'Owner Phone' },
  { key: 'sourceLinkPhone', label: 'Source Link (Phone)' },
  { key: 'ownerEmail', label: 'Owner Email' },
  { key: 'sourceLinkEmail', label: 'Source Link (Email)' },
  { key: 'bookingDateTime', label: 'Booking Date/Time' },
  { key: 'notes', label: 'Notes' },
  { key: 'email1Draft', label: 'Email 1 Draft' },
  { key: 'call1Script', label: 'Call 1 Script' },
  { key: 'email2Draft', label: 'Email 2 Draft' },
  { key: 'call2Script', label: 'Call 2 Script' },
  { key: 'resortAddress', label: 'Resort Address' },
  { key: 'locationCount', label: '# of Locations' },
  { key: 'generalEmail', label: 'General Email' },
  { key: 'generalPhone', label: 'General Phone' },
  { key: 'businessPosition', label: 'Business Position' },
  { key: 'officePhone', label: 'Office Phone Number' },
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
