/** Monday's primary column (e.g. "Client") is the item name — not in column_values. */
export const MONDAY_ITEM_NAME_COLUMN_ID = '__monday_item_name__'

export const MONDAY_ITEM_NAME_COLUMN_LABEL = 'Client (item name)'

export type MondayColumnRef = {
  id: string
  title: string
  type: string
  text: string
  value?: string
}

export type MondayBoardItemRaw = {
  id: string
  name: string
  email?: string
  columnValues?: MondayColumnRef[]
}

export type MondayClientField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'company'
  | 'website'
  | 'businessCategory'
  | 'propertyOwnership'
  | 'businessAddress'

export type MondayColumnMapping = Record<MondayClientField, string | null>

export type ParsedMondayClient = {
  mondayItemId: string
  itemName: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string
  company: string
  website: string
  businessCategory: string
  propertyOwnership: string
  businessAddress: string
  emailMissing: boolean
}

export const MONDAY_CLIENT_FIELDS: Array<{ key: MondayClientField; label: string; required?: boolean }> = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'email', label: 'Email', required: true },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Business name' },
  { key: 'website', label: 'Business website' },
  { key: 'businessCategory', label: 'Business category' },
  { key: 'propertyOwnership', label: 'Property ownership' },
  { key: 'businessAddress', label: 'Business address' },
]

const FIELD_COLUMN_PATTERNS: Record<MondayClientField, RegExp[]> = {
  firstName: [/first\s*name/i, /^first$/i, /given\s*name/i, /owner\s*first/i],
  lastName: [/last\s*name/i, /^last$/i, /surname/i, /family\s*name/i, /owner\s*last/i],
  email: [/e-?mail/i, /email\s*address/i],
  phone: [/phone/i, /mobile/i, /cell/i, /telephone/i, /\btel\b/i],
  company: [/company/i, /business\s*name/i, /organization/i, /account\s*name/i, /deal\s*name/i, /client\s*name/i],
  website: [/website/i, /web\s*site/i, /\burl\b/i, /domain/i, /site\s*url/i],
  businessCategory: [/categor/i, /business\s*type/i, /service\s*type/i, /vertical/i, /segment/i],
  propertyOwnership: [/property/i, /real\s*estate/i, /own.*real/i, /lease.*own/i, /building/i],
  businessAddress: [/address/i, /location/i, /city/i, /street/i],
}

const EMAIL_LIKE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const PHONE_LIKE = /(?:\+?\d[\d\s().-]{7,}\d)/g
const URL_LIKE = /https?:\/\/[^\s]+|www\.[^\s]+/gi

function normalizeTitle(title: string) {
  return title.trim().toLowerCase()
}

function scoreColumnForField(column: MondayColumnRef, field: MondayClientField): number {
  if (column.id === MONDAY_ITEM_NAME_COLUMN_ID) {
    if (field === 'company') return 14
    if (field === 'firstName') return 8
    return 0
  }

  const title = normalizeTitle(column.title)
  const patterns = FIELD_COLUMN_PATTERNS[field]
  let score = 0
  for (const pattern of patterns) {
    if (pattern.test(column.title)) score += 10
  }
  if (field === 'email' && (column.type === 'email' || title.includes('email'))) score += 8
  if (field === 'phone' && (column.type === 'phone' || title.includes('phone'))) score += 8
  if (field === 'website' && (column.type === 'link' || title.includes('link'))) score += 4
  if (field === 'company' && title === 'name') score += 2
  return score
}

export function collectBoardColumns(items: MondayBoardItemRaw[]): MondayColumnRef[] {
  const byId = new Map<string, MondayColumnRef>()
  for (const item of items) {
    for (const column of item.columnValues ?? []) {
      if (!column.id) continue
      if (!byId.has(column.id)) {
        byId.set(column.id, {
          id: column.id,
          title: column.title,
          type: column.type,
          text: column.text ?? '',
          value: column.value,
        })
      }
    }
  }
  const itemNameColumn: MondayColumnRef = {
    id: MONDAY_ITEM_NAME_COLUMN_ID,
    title: MONDAY_ITEM_NAME_COLUMN_LABEL,
    type: 'name',
    text: items[0]?.name ?? '',
  }
  return [itemNameColumn, ...Array.from(byId.values()).sort((a, b) => a.title.localeCompare(b.title))]
}

export function suggestColumnMapping(columns: MondayColumnRef[]): MondayColumnMapping {
  const mapping: MondayColumnMapping = {
    firstName: null,
    lastName: null,
    email: null,
    phone: null,
    company: null,
    website: null,
    businessCategory: null,
    propertyOwnership: null,
    businessAddress: null,
  }
  const used = new Set<string>()

  const fields: MondayClientField[] = ['email', 'phone', 'company', 'website', 'firstName', 'lastName', 'businessCategory', 'propertyOwnership', 'businessAddress']
  for (const field of fields) {
    const ranked = columns
      .map(column => ({ column, score: scoreColumnForField(column, field) }))
      .filter(entry => entry.score > 0 && !used.has(entry.column.id))
      .sort((a, b) => b.score - a.score)
    if (ranked[0]) {
      mapping[field] = ranked[0].column.id
      used.add(ranked[0].column.id)
    }
  }

  return mapping
}

export function mappingConfidence(columns: MondayColumnRef[], mapping: MondayColumnMapping): 'high' | 'medium' | 'low' {
  const hasEmail = Boolean(mapping.email)
  const hasName = Boolean(mapping.firstName || mapping.lastName || mapping.company)
  if (hasEmail && hasName) return 'high'
  if (hasEmail || hasName) return 'medium'
  if (columns.length === 0) return 'low'
  return 'low'
}

function readColumnText(column: MondayColumnRef | undefined): string {
  if (!column) return ''
  const direct = String(column.text ?? '').trim()
  if (direct) return direct
  if (column.value == null || column.value === '') return ''
  try {
    const parsed = typeof column.value === 'string' ? JSON.parse(column.value) : column.value
    if (column.type === 'link') {
      return String(parsed?.url || parsed?.link || parsed?.text || '').trim()
    }
    return String(parsed?.text || parsed?.value || parsed?.email || '').trim()
  } catch {
    return String(column.value).trim()
  }
}

function readMappedFieldValue(item: MondayBoardItemRaw, mapping: MondayColumnMapping, field: MondayClientField): string {
  const columnId = mapping[field]
  if (!columnId) return ''
  if (columnId === MONDAY_ITEM_NAME_COLUMN_ID) return String(item.name || '').trim()
  const column = (item.columnValues ?? []).find(entry => entry.id === columnId)
  return readColumnText(column)
}

function extractEmailFromText(text: string): string {
  const match = text.match(EMAIL_LIKE)
  return match?.[0]?.toLowerCase() ?? ''
}

function extractPhoneFromText(text: string): string {
  const cleaned = text.replace(EMAIL_LIKE, '').trim()
  const match = cleaned.match(PHONE_LIKE)
  return match?.[0]?.trim() ?? cleaned
}

function normalizeWebsite(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const urlMatch = trimmed.match(URL_LIKE)
  const raw = urlMatch?.[0] ?? trimmed
  if (/^https?:\/\//i.test(raw)) return raw
  if (/^www\./i.test(raw)) return `https://${raw}`
  if (raw.includes('.') && !raw.includes('@')) return `https://${raw}`
  return raw
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

export function applyColumnMapping(item: MondayBoardItemRaw, mapping: MondayColumnMapping): ParsedMondayClient {
  const columns = item.columnValues ?? []

  let firstName = readMappedFieldValue(item, mapping, 'firstName')
  let lastName = readMappedFieldValue(item, mapping, 'lastName')
  let email = readMappedFieldValue(item, mapping, 'email')
  let phone = readMappedFieldValue(item, mapping, 'phone')
  let company = readMappedFieldValue(item, mapping, 'company')
  let website = normalizeWebsite(readMappedFieldValue(item, mapping, 'website'))
  const businessCategory = readMappedFieldValue(item, mapping, 'businessCategory')
  const propertyOwnership = readMappedFieldValue(item, mapping, 'propertyOwnership')
  const businessAddress = readMappedFieldValue(item, mapping, 'businessAddress')

  if (!email && item.email) email = item.email.trim().toLowerCase()
  if (!email) {
    for (const column of columns) {
      const found = extractEmailFromText(readColumnText(column))
      if (found) {
        email = found
        break
      }
    }
  }

  if (!phone) {
    for (const column of columns) {
      const found = extractPhoneFromText(readColumnText(column))
      if (found && found.replace(/\D/g, '').length >= 7) {
        phone = found
        break
      }
    }
  }

  if (!website) {
    for (const column of columns) {
      const title = normalizeTitle(column.title)
      if (title.includes('website') || title.includes('url') || title.includes('link')) {
        website = normalizeWebsite(readColumnText(column))
        if (website) break
      }
    }
  }

  if (!company) {
    const nameColumn = columns.find(column => normalizeTitle(column.title) === 'company')
    if (nameColumn) company = readColumnText(nameColumn)
  }

  const itemName = String(item.name || '').trim()
  if (!firstName && !lastName && itemName) {
    const split = splitFullName(itemName)
    firstName = split.firstName
    lastName = split.lastName
  }

  if (!company && itemName && !firstName && !lastName) {
    company = itemName
  }

  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || itemName || company

  return {
    mondayItemId: item.id,
    itemName,
    firstName,
    lastName,
    fullName,
    email: email.trim().toLowerCase(),
    phone: phone.trim(),
    company: (company || itemName).trim(),
    website,
    businessCategory: businessCategory.trim(),
    propertyOwnership: propertyOwnership.trim(),
    businessAddress: businessAddress.trim(),
    emailMissing: !email.trim(),
  }
}

export function preferLeadsBoard<T extends { name: string }>(boards: T[]): T | null {
  const exact = boards.find(board => /\bleads?\b/i.test(board.name))
  if (exact) return exact
  return boards.find(board => /lead/i.test(board.name)) ?? null
}

const MAPPING_STORAGE_PREFIX = 'cantara-monday-mapping:'

export function loadStoredMapping(boardId: string): MondayColumnMapping | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(`${MAPPING_STORAGE_PREFIX}${boardId}`)
    if (!raw) return null
    return JSON.parse(raw) as MondayColumnMapping
  } catch {
    return null
  }
}

export function saveStoredMapping(boardId: string, mapping: MondayColumnMapping) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(`${MAPPING_STORAGE_PREFIX}${boardId}`, JSON.stringify(mapping))
}
