import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActiveNylasConnection, scheduleNylasNotetaker } from '@/lib/nylas'

export const dynamic = 'force-dynamic'

function parseTags(input: unknown) {
  if (Array.isArray(input)) {
    return input.map((item) => String(item).trim()).filter(Boolean)
  }
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const items = await (prisma as any).meeting.findMany({
    where: { clientId: params.id },
    include: {
      reports: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ startAt: 'desc' }, { createdAt: 'desc' }],
  })

  return NextResponse.json({ items })
}

async function createMeetingForClient(args: {
  clientId: string
  title: string
  startAt: Date
  endAt: Date | null
  source: 'MANUAL' | 'CALENDAR'
  agenda: string | null
  agendaTags: string[]
  meetingUrl: string | null
  externalEventId: string | null
  externalCalendarId: string | null
  externalProvider: string | null
}) {
  const activeNylasConnection = await getActiveNylasConnection()

  console.info('CLIENT_MEETING_CREATE_START', {
    clientId: args.clientId,
    title: args.title,
    source: args.source,
    startAt: args.startAt.toISOString(),
    hasMeetingUrl: Boolean(args.meetingUrl),
    externalEventId: args.externalEventId,
    nylasConnected: Boolean(activeNylasConnection),
  })

  let item = await (prisma as any).meeting.create({
    data: {
      clientId: args.clientId,
      title: args.title,
      startAt: args.startAt,
      endAt: args.endAt,
      source: args.source,
      agenda: args.agenda,
      agendaTags: args.agendaTags,
      meetingUrl: args.meetingUrl,
      externalEventId: args.externalEventId,
      externalCalendarId: args.externalCalendarId,
      externalProvider: args.externalProvider,
      nylasConnectionId: activeNylasConnection?.id || null,
    },
    include: {
      reports: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  console.info('CLIENT_MEETING_CREATED', {
    meetingId: item.id,
    clientId: item.clientId,
    title: item.title,
    source: item.source,
    externalEventId: item.externalEventId,
    hasMeetingUrl: Boolean(item.meetingUrl),
  })

  if (activeNylasConnection && item.meetingUrl && !item.nylasNotetakerId) {
    try {
      const notetakerResponse = await scheduleNylasNotetaker({
        grantId: activeNylasConnection.grantId,
        meetingLink: item.meetingUrl,
        joinTime: args.startAt,
        title: args.title,
      })

      const notetakerId = notetakerResponse.data?.id
      console.info('CLIENT_MEETING_NOTETAKER_RESPONSE', {
        meetingId: item.id,
        notetakerId: notetakerId || null,
        state: notetakerResponse.data?.state || null,
      })
      if (notetakerId) {
        item = await (prisma as any).meeting.update({
          where: { id: item.id },
          data: {
            nylasConnectionId: activeNylasConnection.id,
            nylasNotetakerId: notetakerId,
            nylasNotetakerState: notetakerResponse.data?.state || 'SCHEDULED',
          },
          include: {
            reports: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        })
        console.info('CLIENT_MEETING_NOTETAKER_SAVED', {
          meetingId: item.id,
          notetakerId: item.nylasNotetakerId,
          state: item.nylasNotetakerState,
        })
      }
    } catch (notetakerError) {
      console.error('NYLAS_NOTETAKER_CREATE_ERROR', notetakerError)
    }
  } else {
    console.info('CLIENT_MEETING_NOTETAKER_SKIPPED', {
      meetingId: item.id,
      hasConnection: Boolean(activeNylasConnection),
      hasMeetingUrl: Boolean(item.meetingUrl),
      alreadyHasNotetaker: Boolean(item.nylasNotetakerId),
    })
  }

  return item
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    console.info('CLIENT_MEETINGS_POST_RECEIVED', {
      clientId: params.id,
      bodyKeys: Object.keys(body || {}),
      source: body?.source || null,
      externalEventId: body?.externalEventId || null,
    })
    const title = String(body.title || '').trim()
    const startAtRaw = String(body.startAt || '').trim()

    if (!title || !startAtRaw) {
      return NextResponse.json({ error: 'title and startAt are required.' }, { status: 400 })
    }

    const client = await prisma.clientProfile.findUnique({ where: { id: params.id } })
    if (!client) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 })
    }

    const startAt = new Date(startAtRaw)
    const endAt = body.endAt ? new Date(String(body.endAt)) : null
    if (Number.isNaN(startAt.getTime()) || (endAt && Number.isNaN(endAt.getTime()))) {
      return NextResponse.json({ error: 'Invalid meeting date.' }, { status: 400 })
    }

    const externalEventId = body.externalEventId ? String(body.externalEventId) : null
    if (externalEventId) {
      const existing = await (prisma as any).meeting.findUnique({
        where: { externalEventId },
        include: { reports: { orderBy: { createdAt: 'desc' }, take: 1 } },
      })
      if (existing) {
        return NextResponse.json({ item: existing })
      }
    }

    const item = await createMeetingForClient({
      clientId: params.id,
      title,
      startAt,
      endAt,
      source: body.source === 'CALENDAR' ? 'CALENDAR' : 'MANUAL',
      agenda: body.agenda ? String(body.agenda) : null,
      agendaTags: parseTags(body.agendaTags),
      meetingUrl: body.meetingUrl ? String(body.meetingUrl) : null,
      externalEventId,
      externalCalendarId: body.externalCalendarId ? String(body.externalCalendarId) : null,
      externalProvider: body.externalProvider ? String(body.externalProvider) : null,
    })

    return NextResponse.json({ item }, { status: 201 })
  } catch (error) {
    console.error('CLIENT_MEETING_CREATE_ERROR', error)
    return NextResponse.json({ error: 'Could not create meeting.' }, { status: 500 })
  }
}
