import { NextRequest, NextResponse } from 'next/server'
import { verifyNylasWebhookSignature } from '@/lib/nylas'

export const dynamic = 'force-dynamic'

type WebhookPayload = {
  challenge?: string
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
  return NextResponse.json({ received: true })
}
