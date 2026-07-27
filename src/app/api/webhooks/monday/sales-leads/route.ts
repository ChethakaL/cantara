import { NextRequest, NextResponse } from 'next/server'
import { getProjectEnv } from '@/lib/project-env'
import { reconcileSalesLeadsFromMonday } from '@/lib/sales-leads/monday-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (body.challenge) return NextResponse.json({ challenge: body.challenge })

  const secret = getProjectEnv('SALES_LEAD_MONDAY_WEBHOOK_SECRET')
  if (secret) {
    const provided = req.headers.get('x-cantara-webhook-secret') || req.nextUrl.searchParams.get('secret')
    if (provided !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const itemId = String(body?.event?.pulseId || body?.event?.itemId || body?.pulseId || '')
  try {
    const result = await reconcileSalesLeadsFromMonday(itemId || undefined)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Webhook processing failed.' },
      { status: 500 },
    )
  }
}
