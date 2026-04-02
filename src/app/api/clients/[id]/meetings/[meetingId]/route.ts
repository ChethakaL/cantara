import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActiveNylasConnection, scheduleNylasNotetaker } from '@/lib/nylas'

export const dynamic = 'force-dynamic'

function parseTags(input: unknown) {
  if (Array.isArray(input)) return input.map((item) => String(item).trim()).filter(Boolean)
  if (typeof input === 'string') return input.split(',').map((item) => item.trim()).filter(Boolean)
  return undefined
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; meetingId: string } }) {
  try {
    const body = await req.json()
    console.info('CLIENT_MEETING_PATCH_RECEIVED', {
      clientId: params.id,
      meetingId: params.meetingId,
      bodyKeys: Object.keys(body || {}),
      hasMeetingUrl: typeof body?.meetingUrl === 'string' ? Boolean(body.meetingUrl) : undefined,
    })
    const existing = await (prisma as any).meeting.findFirst({
      where: { id: params.meetingId, clientId: params.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if ('title' in body) data.title = String(body.title || '').trim()
    if ('agenda' in body) data.agenda = body.agenda ? String(body.agenda) : null
    if ('agendaTags' in body) data.agendaTags = parseTags(body.agendaTags) || []
    if ('meetingUrl' in body) data.meetingUrl = body.meetingUrl ? String(body.meetingUrl) : null
    if ('notesText' in body) data.notesText = body.notesText ? String(body.notesText) : null
    if ('notesFileName' in body) data.notesFileName = body.notesFileName ? String(body.notesFileName) : null
    if ('notesUploadedAt' in body) data.notesUploadedAt = body.notesUploadedAt ? new Date(String(body.notesUploadedAt)) : null

    if ('startAt' in body && body.startAt) {
      const startAt = new Date(String(body.startAt))
      if (Number.isNaN(startAt.getTime())) {
        return NextResponse.json({ error: 'Invalid startAt date.' }, { status: 400 })
      }
      data.startAt = startAt
    }

    if ('endAt' in body) {
      if (!body.endAt) {
        data.endAt = null
      } else {
        const endAt = new Date(String(body.endAt))
        if (Number.isNaN(endAt.getTime())) {
          return NextResponse.json({ error: 'Invalid endAt date.' }, { status: 400 })
        }
        data.endAt = endAt
      }
    }

    let item = await (prisma as any).meeting.update({
      where: { id: params.meetingId },
      data,
      include: {
        reports: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    console.info('CLIENT_MEETING_UPDATED', {
      meetingId: item.id,
      hasMeetingUrl: Boolean(item.meetingUrl),
      hasNotetaker: Boolean(item.nylasNotetakerId),
      startAt: item.startAt.toISOString(),
    })

    const activeNylasConnection = await getActiveNylasConnection()
    const nextMeetingUrl = typeof data.meetingUrl === 'string' ? data.meetingUrl : item.meetingUrl
    const nextStartAt = data.startAt instanceof Date ? data.startAt : item.startAt

    if (activeNylasConnection && nextMeetingUrl && !item.nylasNotetakerId) {
      try {
        const notetakerResponse = await scheduleNylasNotetaker({
          grantId: activeNylasConnection.grantId,
          meetingLink: nextMeetingUrl,
          joinTime: nextStartAt,
          title: item.title,
        })

        const notetakerId = notetakerResponse.data?.id
        console.info('CLIENT_MEETING_PATCH_NOTETAKER_RESPONSE', {
          meetingId: item.id,
          notetakerId: notetakerId || null,
          state: notetakerResponse.data?.state || null,
        })
        if (notetakerId) {
          item = await (prisma as any).meeting.update({
            where: { id: params.meetingId },
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
          console.info('CLIENT_MEETING_PATCH_NOTETAKER_SAVED', {
            meetingId: item.id,
            notetakerId: item.nylasNotetakerId,
            state: item.nylasNotetakerState,
          })
        }
      } catch (notetakerError) {
        console.error('NYLAS_NOTETAKER_UPDATE_ERROR', notetakerError)
      }
    } else {
      console.info('CLIENT_MEETING_PATCH_NOTETAKER_SKIPPED', {
        meetingId: item.id,
        hasConnection: Boolean(activeNylasConnection),
        hasMeetingUrl: Boolean(nextMeetingUrl),
        alreadyHasNotetaker: Boolean(item.nylasNotetakerId),
      })
    }

    return NextResponse.json({ item })
  } catch (error) {
    console.error('CLIENT_MEETING_UPDATE_ERROR', error)
    return NextResponse.json({ error: 'Could not update meeting.' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string; meetingId: string } }) {
  try {
    console.info('CLIENT_MEETING_DELETE_RECEIVED', {
      clientId: params.id,
      meetingId: params.meetingId,
    })
    const existing = await (prisma as any).meeting.findFirst({
      where: { id: params.meetingId, clientId: params.id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 })
    }

    await (prisma as any).meeting.delete({
      where: { id: params.meetingId },
    })

    console.info('CLIENT_MEETING_DELETED', {
      clientId: params.id,
      meetingId: params.meetingId,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('CLIENT_MEETING_DELETE_ERROR', error)
    return NextResponse.json({ error: 'Could not delete meeting.' }, { status: 500 })
  }
}
