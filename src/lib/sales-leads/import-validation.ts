export type SalesLeadImportRow = {
  rowNumber: number
  businessName: string
  assignedCallerEmail?: string
  state?: string
  city?: string
  websiteUrl?: string
  googleRating?: number | null
  reviewCount?: number | null
  sqftIndoor?: number | null
  sqftOutdoor?: number | null
  sqftCombined?: number | null
  locationType?: string
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
  const valueString = value == null ? '' : String(value).trim()
  return /^(not found|not found\.|unknown|n\/a|na)$/i.test(valueString) ? '' : valueString
}

function numberValue(value: unknown) {
  if (value == null || value === '') return null
  const normalized = String(value).trim().replace(/,/g, '').toLowerCase()
  const multiplier = normalized.endsWith('k') ? 1000 : normalized.endsWith('m') ? 1000000 : 1
  const number = Number(normalized.replace(/[km]$/, '')) * multiplier
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

function urlValue(value: unknown) {
  const normalized = stringValue(value)
  if (!normalized) return ''
  if (/^https?:\/\//i.test(normalized)) return normalized
  if (/^(www\.|[a-z0-9-]+\.[a-z]{2,})/i.test(normalized)) return `https://${normalized}`
  return normalized
}

export function normalizeImportRow(row: Record<string, unknown>, rowNumber: number): SalesLeadImportRow {
  const explicitPhoneType = stringValue(firstValue(row, ['phone type', 'owner phone type'])).toUpperCase()
  const explicitEmailType = stringValue(firstValue(row, ['email type', 'owner email type'])).toUpperCase()
  const directPhone = stringValue(firstValue(row, ['owner phone', 'owner phone number', 'phone']))
  const generalPhone = stringValue(firstValue(row, ['general business phone', 'business phone']))
  const directEmail = stringValue(firstValue(row, ['owner email', 'email']))
  const generalEmail = stringValue(firstValue(row, ['general business email', 'business email']))
  const ownerPhone = directPhone || generalPhone
  const ownerEmail = directEmail || generalEmail

  const businessName = stringValue(firstValue(row, ['business name', 'business', 'company', 'facility name', 'customer name', 'resort name', 'name']))
  const numLocations = numberValue(firstValue(row, ['# of locations', 'number of locations', 'locations']))
  const explicitIndependent = booleanValue(firstValue(row, ['independent operator', 'independent', 'chain or franchise']))

  let independentOperator = explicitIndependent
  if (independentOperator == null) {
    if (numLocations != null && numLocations === 1) {
      independentOperator = true
    } else if (numLocations != null && numLocations > 1) {
      independentOperator = false
    } else if (businessName) {
      const isChain = /\b(petsmart|petco|dogtopia|camp bow wow)\b/i.test(businessName)
      independentOperator = !isChain
    }
  }

  const explicitServices = stringValue(firstValue(row, ['services', 'service type', 'type', 'business category']))
  let services = explicitServices
  if (!services && businessName) {
    const isGroomingOnly = /\bgrooming\b/i.test(businessName) && !/\b(resort|boarding|daycare|barn|club|hotel|inn)\b/i.test(businessName)
    const isVet = /\b(vet|veterinary|clinic|hospital)\b/i.test(businessName)
    if (!isGroomingOnly && !isVet) {
      services = 'Dog Boarding & Daycare'
    } else {
      services = businessName
    }
  }

  return {
    rowNumber,
    businessName,
    assignedCallerEmail: stringValue(firstValue(row, ['assigned caller email', 'caller email'])),
    state: stringValue(firstValue(row, ['state'])),
    city: stringValue(firstValue(row, ['city'])),
    websiteUrl: urlValue(firstValue(row, ['website url', 'website'])),
    googleRating: numberValue(firstValue(row, ['google rating', 'google score', 'rating'])),
    reviewCount: numberValue(firstValue(row, ['review count', 'google review count', '# of google reviews', 'reviews'])),
    sqftIndoor: numberValue(firstValue(row, ['square footage (indoor)', 'indoor square footage', 'indoor sqft'])),
    sqftOutdoor: numberValue(firstValue(row, ['square footage (outdoor)', 'outdoor square footage', 'outdoor sqft'])),
    sqftCombined: numberValue(firstValue(row, ['square footage (combined)', 'total square footage', 'combined square footage'])),
    locationType: stringValue(firstValue(row, ['location type', 'urban / suburban / rural', 'urban/suburban/rural'])),
    ownerFirstName: stringValue(firstValue(row, ['owner first name', 'first name'])),
    ownerLastName: stringValue(firstValue(row, ['owner last name', 'last name'])),
    ownerPhone,
    ownerEmail,
    phoneType: explicitPhoneType === 'DIRECT' || (!explicitPhoneType && Boolean(directPhone)) ? 'DIRECT' : 'GENERAL',
    emailType: explicitEmailType === 'DIRECT' || (!explicitEmailType && Boolean(directEmail)) ? 'DIRECT' : 'GENERAL',
    sourceLinkPhone: urlValue(firstValue(row, ['owner phone source', 'source link (phone)', 'source link phone', 'phone source'])),
    sourceLinkEmail: urlValue(firstValue(row, ['owner email source', 'source link (email)', 'source link email', 'email source'])),
    preCallBriefUrl: urlValue(firstValue(row, ['pre-call brief', 'pre call brief', 'pre-call brief url'])),
    notes: stringValue(firstValue(row, ['notes'])),
    independentOperator,
    services,
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
      const hasBoardingOrDaycare = /\b(boarding|daycare|day care|resort|barn|club|hotel|inn|paws)\b/.test(services)
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
