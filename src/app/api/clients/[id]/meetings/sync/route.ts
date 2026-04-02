import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type CalendarEventPayload = {
  id?: string
  title?: string
  calendar_id?: string
  location?: string
  conferencing?: unknown
  locations?: unknown
  when?: { start_time?: number; end_time?: number }
}

function normalizeTitle(value: string | undefined | null) {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function scoreMeeting(meeting: {
  agenda?: string | null
  notesText?: string | null
  meetingUrl?: string | null
  reports?: unknown[]
  agendaTags?: string[]
  nylasNotetakerId?: string | null
}) {
  let score = 0
  if (meeting.agenda?.trim()) score += 3
  if (meeting.notesText?.trim()) score += 4
  if (meeting.meetingUrl?.trim()) score += 2
  if ((meeting.reports || []).length) score += 5
  if ((meeting.agendaTags || []).filter((tag) => tag.toLowerCase() !== 'add agenda').length) score += 2
  if (meeting.nylasNotetakerId) score += 2
  return score
}

function isSameMeetingWindow(a: Date, b: Date) {
  return Math.abs(a.getTime() - b.getTime()) <= 2 * 60 * 1000
}

function extractMeetingUrl(event: CalendarEventPayload) {
  const conferencingItems = Array.isArray(event.conferencing)
    ? event.conferencing
    : event.conferencing && typeof event.conferencing === 'object'
      ? [event.conferencing as Record<string, unknown>]
      : []

  for (const item of conferencingItems) {
    if (typeof item.url === 'string') return item.url
    if (typeof item.meeting_link === 'string') return item.meeting_link
    if (item.details && typeof item.details === 'object' && typeof (item.details as { url?: unknown }).url === 'string') {
      return (item.details as { url: string }).url
    }
  }

  const locationItems = Array.isArray(event.locations)
    ? event.locations
    : event.locations && typeof event.locations === 'object'
      ? [event.locations as Record<string, unknown>]
      : []

  for (const item of locationItems) {
    if (typeof item.uri === 'string') return item.uri
  }

  return typeof event.location === 'string' ? event.location : null
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const events = Array.isArray(body.events) ? (body.events as CalendarEventPayload[]) : []

    console.info('CLIENT_MEETING_SYNC_START', {
      clientId: params.id,
      eventCount: events.length,
    })

    const client = await prisma.clientProfile.findUnique({ where: { id: params.id } })
    if (!client) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    }

    const existingMeetings = await (prisma as any).meeting.findMany({
      where: { clientId: params.id },
      include: {
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    const existingIds = new Set(existingMeetings.map((item: { externalEventId?: string | null }) => item.externalEventId).filter(Boolean))

    const created = []
    const merged = []

    for (const event of events) {
      if (!event.id || !event.when?.start_time) continue

      const eventStartAt = new Date(event.when.start_time * 1000)
      const eventTitle = normalizeTitle(event.title || 'Untitled meeting')
      const matchingMeetings = existingMeetings.filter((meeting: any) =>
        normalizeTitle(meeting.title) === eventTitle && isSameMeetingWindow(new Date(meeting.startAt), eventStartAt)
      )

      const exactExternalMatch = matchingMeetings.find((meeting: any) => meeting.externalEventId === event.id)
      const bestMatch = matchingMeetings
        .slice()
        .sort((a: any, b: any) => scoreMeeting(b) - scoreMeeting(a))[0]

      if (exactExternalMatch && matchingMeetings.length <= 1) {
        existingIds.add(event.id)
        continue
      }

      if (bestMatch) {
        const duplicatesToDelete = matchingMeetings.filter((meeting: any) => meeting.id !== bestMatch.id)

        await (prisma as any).meeting.update({
          where: { id: bestMatch.id },
          data: {
            source: 'CALENDAR',
            externalEventId: event.id,
            externalCalendarId: event.calendar_id || bestMatch.externalCalendarId || null,
            externalProvider: bestMatch.externalProvider || null,
            meetingUrl: bestMatch.meetingUrl || extractMeetingUrl(event),
            agendaTags: Array.from(new Set([...(bestMatch.agendaTags || []), 'add agenda'])),
          },
        })

        for (const duplicate of duplicatesToDelete) {
          await (prisma as any).meetingReport.deleteMany({
            where: { meetingId: duplicate.id },
          })
          await (prisma as any).meeting.delete({
            where: { id: duplicate.id },
          })
        }

        merged.push({ externalEventId: event.id, keptMeetingId: bestMatch.id, removedIds: duplicatesToDelete.map((item: any) => item.id) })
        console.info('CLIENT_MEETING_SYNC_MERGED', {
          clientId: params.id,
          externalEventId: event.id,
          keptMeetingId: bestMatch.id,
          removedIds: duplicatesToDelete.map((item: any) => item.id),
        })
        existingIds.add(event.id)
        continue
      }

      if (existingIds.has(event.id)) continue

      const item = await (prisma as any).meeting.create({
        data: {
          clientId: params.id,
          title: event.title || 'Untitled meeting',
          startAt: eventStartAt,
          endAt: event.when.end_time ? new Date(event.when.end_time * 1000) : null,
          source: 'CALENDAR',
          agenda: null,
          agendaTags: ['add agenda'],
          meetingUrl: extractMeetingUrl(event),
          externalEventId: event.id,
          externalCalendarId: event.calendar_id || null,
          externalProvider: null,
        },
      })
      created.push(item)
      console.info('CLIENT_MEETING_SYNC_CREATED', {
        clientId: params.id,
        meetingId: item.id,
        externalEventId: event.id,
        title: item.title,
      })
      existingMeetings.push({ ...item, reports: [] })
      existingIds.add(event.id)
    }

    console.info('CLIENT_MEETING_SYNC_DONE', {
      clientId: params.id,
      createdCount: created.length,
      mergedCount: merged.length,
    })

    return NextResponse.json({ createdCount: created.length, created, mergedCount: merged.length, merged })
  } catch (error) {
    console.error('CLIENT_MEETING_SYNC_ERROR', error)
    return NextResponse.json({ error: 'Could not sync calendar meetings.' }, { status: 500 })
  }
}
