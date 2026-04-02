import { NextRequest, NextResponse } from 'next/server'
import { verifyNylasWebhookSignature } from '@/lib/nylas'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signatureHeader = req.headers.get('x-nylas-signature')

  if (!verifyNylasWebhookSignature(rawBody, signatureHeader)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 })
  }

  return NextResponse.json({ received: true })
}
