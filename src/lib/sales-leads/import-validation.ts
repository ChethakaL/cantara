export type SalesLeadImportRow = {
  rowNumber: number
  businessName: string
  assignedCallerEmail?: string
  state?: string
  city?: string
  websiteUrl?: string
  googleRating?: number | null
  reviewCount?: number | null
  ownerFirstName?: string
  ownerLastName?: string
  ownerPhone?: string
  ownerEmail?: string
  phoneType?: 'DIRECT' | 'GENERAL'
  emailType?: 'DIRECT' | 'GENERAL'
  sourceLinkPhone?: string
  sourceLinkEmail?: string
  preCallBriefUrl?: string
  notes?: string
  independentOperator?: boolean | null
  services?: string
}

export type ValidatedSalesLeadImportRow = SalesLeadImportRow & {
  normalizedKey: string
  qualified: boolean
  errors: string[]
  warnings: string[]
}

function stringValue(value: unknown) {
  return value == null ? '' : String(value).trim()
}

function numberValue(value: unknown) {
  if (value == null || value === '') return null
  const number = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(number) ? number : null
}

function booleanValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  const normalized = stringValue(value).toLowerCase()
  if (['yes', 'true', 'independent', '1'].includes(normalized)) return true
  if (['no', 'false', 'chain', 'franchise', '0'].includes(normalized)) return false
  return null
}

function firstValue(row: Record<string, unknown>, names: string[]) {
  const entries = Object.entries(row)
  for (const name of names) {
    const found = entries.find(([key]) => key.trim().toLowerCase() === name)
    if (found) return found[1]
  }
  return undefined
}

export function normalizeImportRow(row: Record<string, unknown>, rowNumber: number): SalesLeadImportRow {
  const phoneType = stringValue(firstValue(row, ['phone type', 'owner phone type'])).toUpperCase()
  const emailType = stringValue(firstValue(row, ['email type', 'owner email type'])).toUpperCase()
  return {
    rowNumber,
    businessName: stringValue(firstValue(row, ['business name', 'business', 'company', 'facility name', 'customer name', 'name'])),
    assignedCallerEmail: stringValue(firstValue(row, ['assigned caller email', 'caller email'])),
    state: stringValue(firstValue(row, ['state'])),
    city: stringValue(firstValue(row, ['city'])),
    websiteUrl: stringValue(firstValue(row, ['website url', 'website'])),
    googleRating: numberValue(firstValue(row, ['google rating', 'rating'])),
    reviewCount: numberValue(firstValue(row, ['review count', 'google review count', 'reviews'])),
    ownerFirstName: stringValue(firstValue(row, ['owner first name', 'first name'])),
    ownerLastName: stringValue(firstValue(row, ['owner last name', 'last name'])),
    ownerPhone: stringValue(firstValue(row, ['owner phone', 'phone'])),
    ownerEmail: stringValue(firstValue(row, ['owner email', 'email'])),
    phoneType: phoneType === 'DIRECT' ? 'DIRECT' : 'GENERAL',
    emailType: emailType === 'DIRECT' ? 'DIRECT' : 'GENERAL',
    sourceLinkPhone: stringValue(firstValue(row, ['source link (phone)', 'source link phone', 'phone source'])),
    sourceLinkEmail: stringValue(firstValue(row, ['source link (email)', 'source link email', 'email source'])),
    preCallBriefUrl: stringValue(firstValue(row, ['pre-call brief', 'pre call brief', 'pre-call brief url'])),
    notes: stringValue(firstValue(row, ['notes'])),
    independentOperator: booleanValue(firstValue(row, ['independent operator', 'independent', 'chain or franchise'])),
    services: stringValue(firstValue(row, ['services', 'service type', 'type', 'business category'])),
  }
}

export function importKey(row: Pick<SalesLeadImportRow, 'businessName' | 'city' | 'state' | 'websiteUrl'>) {
  const website = (row.websiteUrl || '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
  if (website) return `website:${website}`
  return `business:${row.businessName.toLowerCase().replace(/\s+/g, ' ')}|${(row.city || '').toLowerCase()}|${(row.state || '').toLowerCase()}`
}

export function validateImportRows(
  rows: SalesLeadImportRow[],
  existingKeys: ReadonlySet<string> = new Set(),
): ValidatedSalesLeadImportRow[] {
  const seen = new Set<string>()
  return rows.map(row => {
    const errors: string[] = []
    const warnings: string[] = []
    const normalizedKey = importKey(row)
    const services = (row.services || '').toLowerCase()

    if (!row.businessName) errors.push('Business name is required.')
    if (row.independentOperator !== true) errors.push('Independent-operator qualification is required.')
    if (!services) {
      errors.push('Boarding/daycare service qualification is required.')
    } else {
      const hasBoardingOrDaycare = /\b(boarding|daycare|day care)\b/.test(services)
      const isExcluded = /\b(vet|veterinary)\b/.test(services) || (/groom/.test(services) && !hasBoardingOrDaycare)
      if (!hasBoardingOrDaycare || isExcluded) errors.push('Lead must offer boarding/daycare and cannot be grooming-only or veterinary.')
    }
    if (row.googleRating == null || row.googleRating < 4.5) errors.push('Google rating must be at least 4.5.')
    if (row.reviewCount == null || row.reviewCount < 50) errors.push('Google review count must be at least 50.')
    if (!row.ownerEmail) warnings.push('Owner email is missing; email actions will be unavailable.')
    if (!row.ownerPhone) warnings.push('Owner phone is missing; call actions may be blocked operationally.')
    if (existingKeys.has(normalizedKey)) errors.push('Lead already exists.')
    if (seen.has(normalizedKey)) errors.push('Duplicate row in this import.')
    seen.add(normalizedKey)

    return { ...row, normalizedKey, qualified: errors.length === 0, errors, warnings }
  })
}
