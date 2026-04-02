import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { syncMeetingAssistantFromMedia } from '@/lib/meeting-assistant'
import { verifyNylasWebhookSignature } from '@/lib/nylas'

export const dynamic = 'force-dynamic'

type WebhookPayload = {
  challenge?: string
  type?: string
  data?: Record<string, unknown>
}

export async function GET(req: NextRequest) {
  const challenge = new URL(req.url).searchParams.get('challenge')
  if (!challenge) {
    console.info('NYLAS_WEBHOOK_GET_OK')
    return NextResponse.json({ ok: true })
  }

  console.info('NYLAS_WEBHOOK_GET_CHALLENGE', { challengeLength: challenge.length })
  return new NextResponse(challenge, { status: 200 })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  let payload: WebhookPayload = {}

  try {
    payload = rawBody ? (JSON.parse(rawBody) as WebhookPayload) : {}
  } catch {
    payload = {}
  }

  console.info('NYLAS_WEBHOOK_POST_RECEIVED', {
    hasSignature: Boolean(req.headers.get('x-nylas-signature')),
    bodyLength: rawBody.length,
    hasChallenge: Boolean(payload.challenge),
  })

  if (payload.challenge) {
    console.info('NYLAS_WEBHOOK_POST_CHALLENGE', { challengeLength: payload.challenge.length })
    return new NextResponse(payload.challenge, { status: 200 })
  }

  const signatureHeader = req.headers.get('x-nylas-signature')

  if (!verifyNylasWebhookSignature(rawBody, signatureHeader)) {
    console.warn('NYLAS_WEBHOOK_SIGNATURE_INVALID', {
      hasSignature: Boolean(signatureHeader),
      bodyLength: rawBody.length,
    })
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  }

  console.info('NYLAS_WEBHOOK_SIGNATURE_VALID')
  const eventType = payload.type || ''
  const data = payload.data || {}
  const objectRecord =
    data.object && typeof data.object === 'object' && !Array.isArray(data.object)
      ? (data.object as Record<string, unknown>)
      : {}
  const notetakerId =
    (typeof objectRecord.id === 'string' && objectRecord.id) ||
    (typeof data.id === 'string' && data.id) ||
    (typeof data.notetaker_id === 'string' && data.notetaker_id) ||
    ''

  console.info('NYLAS_WEBHOOK_EVENT', {
    eventType,
    notetakerId,
    dataKeys: Object.keys(data),
    objectKeys: Object.keys(objectRecord),
  })

  const meeting = notetakerId
    ? await (prisma as any).meeting.findFirst({
        where: { nylasNotetakerId: notetakerId },
        include: {
          reports: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      })
    : null

  if (!meeting) {
    console.warn('NYLAS_WEBHOOK_IGNORED_NO_MEETING', { eventType, notetakerId })
    return NextResponse.json({ received: true, ignored: true })
  }

  if (eventType.startsWith('notetaker.') && eventType !== 'notetaker.media') {
    const payloadState =
      (typeof objectRecord.state === 'string' && objectRecord.state) ||
      (typeof data.state === 'string' && data.state) ||
      eventType.replace('notetaker.', '')
    const nextState = String(payloadState).toUpperCase()
    await (prisma as any).meeting.update({
      where: { id: meeting.id },
      data: {
        nylasNotetakerState: nextState,
        nylasNotetakerLastWebhookAt: new Date(),
      },
    })

    console.info('NYLAS_WEBHOOK_STATE_UPDATED', {
      meetingId: meeting.id,
      notetakerId,
      eventType,
      nextState,
    })

    return NextResponse.json({ received: true, updated: true })
  }

  if (eventType === 'notetaker.media') {
    try {
      await syncMeetingAssistantFromMedia({
        meetingId: meeting.id,
        notetakerId,
        media: data,
      })

      console.info('NYLAS_WEBHOOK_MEDIA_PROCESSED', {
        meetingId: meeting.id,
        notetakerId,
      })

      return NextResponse.json({ received: true, updated: true })
    } catch (error) {
      console.error('NYLAS_WEBHOOK_MEDIA_ERROR', {
        meetingId: meeting.id,
        notetakerId,
        error: error instanceof Error ? error.message : String(error),
      })
      return NextResponse.json({ error: 'Could not process webhook media.' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
