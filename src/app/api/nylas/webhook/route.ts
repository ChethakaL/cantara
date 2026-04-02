import { NextRequest, NextResponse } from 'next/server'
import { verifyNylasWebhookSignature } from '@/lib/nylas'

export const dynamic = 'force-dynamic'

type WebhookPayload = {
  challenge?: string
}

export async function GET(req: NextRequest) {
  const challenge = new URL(req.url).searchParams.get('challenge')
  if (!challenge) {
    return NextResponse.json({ ok: true })
  }

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

  if (payload.challenge) {
    return new NextResponse(payload.challenge, { status: 200 })
  }

  const signatureHeader = req.headers.get('x-nylas-signature')

  if (!verifyNylasWebhookSignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  }

  return NextResponse.json({ received: true })
}
