export type LeadCalendarMatchInput = {
  businessName?: string | null
  ownerFirstName?: string | null
  ownerLastName?: string | null
  ownerEmail?: string | null
  nextActionDate?: Date | string | null
  bookingDateTime?: Date | string | null
}

export type MatchedCalendarEvent = {
  id: string
  title: string
  start: string | null
  end: string | null
  htmlLink: string | null
  location: string | null
  attendees: Array<{ email: string | null; displayName: string | null }>
  matchReason: string
}

function asDate(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function sameUtcDay(left: Date, right: Date) {
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10)
}

export function leadCalendarNeedles(lead: LeadCalendarMatchInput) {
  const ownerName = [lead.ownerFirstName, lead.ownerLastName].filter(Boolean).join(' ').trim()
  return {
    email: (lead.ownerEmail || '').trim().toLowerCase(),
    ownerName: ownerName.toLowerCase(),
    firstName: (lead.ownerFirstName || '').trim().toLowerCase(),
    lastName: (lead.ownerLastName || '').trim().toLowerCase(),
    businessName: (lead.businessName || '').trim().toLowerCase(),
  }
}

function eventStart(event: Record<string, unknown>) {
  const start = event.start as { dateTime?: string; date?: string } | string | undefined
  if (!start) return null
  if (typeof start === 'string') return asDate(start)
  return asDate(start.dateTime || start.date || null)
}

function eventEnd(event: Record<string, unknown>) {
  const end = event.end as { dateTime?: string; date?: string } | string | undefined
  if (!end) return null
  if (typeof end === 'string') return asDate(end)
  return asDate(end.dateTime || end.date || null)
}

function eventAttendees(event: Record<string, unknown>) {
  const attendees = Array.isArray(event.attendees) ? event.attendees : []
  return attendees.map((item: any) => ({
    email: typeof item?.email === 'string' ? item.email : null,
    displayName: typeof item?.displayName === 'string' ? item.displayName : null,
  }))
}

function eventHaystack(event: Record<string, unknown>) {
  const attendees = eventAttendees(event)
  return [
    event.summary,
    event.title,
    event.description,
    event.location,
    ...attendees.map(item => item.email),
    ...attendees.map(item => item.displayName),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function calendarEventMatchesLead(event: Record<string, unknown>, lead: LeadCalendarMatchInput) {
  const needles = leadCalendarNeedles(lead)
  const hay = eventHaystack(event)
  const attendees = eventAttendees(event)
  const start = eventStart(event)
  const nextAction = asDate(lead.nextActionDate)
  const booking = asDate(lead.bookingDateTime)

  if (needles.email && attendees.some(item => (item.email || '').toLowerCase() === needles.email)) {
    return { matched: true, reason: 'Owner email is on the invite' }
  }
  if (needles.email && hay.includes(needles.email)) {
    return { matched: true, reason: 'Owner email appears in the event' }
  }
  if (needles.businessName && needles.businessName.length > 3 && hay.includes(needles.businessName)) {
    return { matched: true, reason: 'Business name appears in the event' }
  }
  if (needles.ownerName && needles.ownerName.length > 3 && hay.includes(needles.ownerName)) {
    return { matched: true, reason: 'Owner name appears in the event' }
  }
  if (needles.lastName && needles.lastName.length > 3 && hay.includes(needles.lastName) && start && nextAction && sameUtcDay(start, nextAction)) {
    return { matched: true, reason: 'Last name matches a meeting on the next stage date' }
  }
  if (start && nextAction && sameUtcDay(start, nextAction) && needles.firstName && needles.firstName.length > 2 && hay.includes(needles.firstName)) {
    return { matched: true, reason: 'First name matches a meeting on the next stage date' }
  }
  if (start && booking && sameUtcDay(start, booking)) {
    return { matched: true, reason: 'Meeting is on the booked call date' }
  }
  return { matched: false, reason: '' }
}

export function normalizeCalendarEvent(event: Record<string, unknown>, matchReason: string): MatchedCalendarEvent | null {
  const id = String(event.id || event.iCalUID || '')
  if (!id) return null
  const start = eventStart(event)
  const end = eventEnd(event)
  return {
    id,
    title: String(event.summary || event.title || 'Untitled event'),
    start: start?.toISOString() || null,
    end: end?.toISOString() || null,
    htmlLink: typeof event.htmlLink === 'string' ? event.htmlLink : typeof event.html_link === 'string' ? event.html_link : null,
    location: typeof event.location === 'string' ? event.location : null,
    attendees: eventAttendees(event),
    matchReason,
  }
}

function extractEventList(payload: unknown): Record<string, unknown>[] {
  if (!payload) return []
  if (Array.isArray(payload)) return payload.filter(item => item && typeof item === 'object') as Record<string, unknown>[]
  if (typeof payload !== 'object') return []
  const record = payload as Record<string, unknown>
  for (const key of ['items', 'events', 'data']) {
    const nested = extractEventList(record[key])
    if (nested.length) return nested
  }
  if (record.id || record.summary || record.start) return [record]
  return []
}

export function collectMatchingCalendarEvents(payloads: unknown[], lead: LeadCalendarMatchInput) {
  const seen = new Set<string>()
  const matches: MatchedCalendarEvent[] = []
  for (const payload of payloads) {
    for (const event of extractEventList(payload)) {
      const result = calendarEventMatchesLead(event, lead)
      if (!result.matched) continue
      const normalized = normalizeCalendarEvent(event, result.reason)
      if (!normalized || seen.has(normalized.id)) continue
      seen.add(normalized.id)
      matches.push(normalized)
    }
  }
  return matches.sort((a, b) => String(a.start || '').localeCompare(String(b.start || ''))).slice(0, 8)
}
