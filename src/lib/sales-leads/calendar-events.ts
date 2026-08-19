import { executeAdvisorCalendarTool, getAdvisorCalendarConnection } from '@/lib/composio/calendar'
import {
  collectMatchingCalendarEvents,
  type LeadCalendarMatchInput,
  type MatchedCalendarEvent,
} from '@/lib/sales-leads/calendar-match'

function isoDaysAround(value: Date | string | null | undefined, beforeDays: number, afterDays: number) {
  if (!value) return null
  const center = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(center.getTime())) return null
  const min = new Date(center)
  min.setUTCDate(min.getUTCDate() - beforeDays)
  min.setUTCHours(0, 0, 0, 0)
  const max = new Date(center)
  max.setUTCDate(max.getUTCDate() + afterDays)
  max.setUTCHours(23, 59, 59, 999)
  return { time_min: min.toISOString(), time_max: max.toISOString() }
}

export async function findLeadCalendarEvents(userId: string, lead: LeadCalendarMatchInput): Promise<{
  connected: boolean
  events: MatchedCalendarEvent[]
}> {
  const connection = await getAdvisorCalendarConnection(userId)
  if (!connection) return { connected: false, events: [] }

  const queries = Array.from(
    new Set(
      [lead.ownerEmail, [lead.ownerFirstName, lead.ownerLastName].filter(Boolean).join(' '), lead.businessName]
        .map(value => (value || '').trim())
        .filter(value => value.length > 2),
    ),
  )

  const windows = [
    isoDaysAround(lead.nextActionDate, 2, 2),
    isoDaysAround(lead.bookingDateTime, 1, 1),
    isoDaysAround(new Date(), 0, 45),
  ].filter(Boolean) as Array<{ time_min: string; time_max: string }>

  const payloads: unknown[] = []
  for (const query of queries) {
    const window = windows[0] || windows[windows.length - 1]
    const found = await executeAdvisorCalendarTool(userId, 'GOOGLECALENDAR_FIND_EVENT', {
      query,
      calendar_id: 'primary',
      single_events: true,
      max_results: 25,
      ...(window || {}),
    }).catch(error => {
      console.warn('[calendar] FIND_EVENT failed', error)
      return null
    })
    if (found) payloads.push(found)
  }

  const dateWindow = windows[0]
  if (dateWindow) {
    const listed = await executeAdvisorCalendarTool(userId, 'GOOGLECALENDAR_EVENTS_LIST', {
      calendarId: 'primary',
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
      timeMin: dateWindow.time_min,
      timeMax: dateWindow.time_max,
    }).catch(error => {
      console.warn('[calendar] EVENTS_LIST failed', error)
      return null
    })
    if (listed) payloads.push(listed)
  }

  return { connected: true, events: collectMatchingCalendarEvents(payloads, lead) }
}
