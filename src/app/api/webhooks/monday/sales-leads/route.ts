import { NextRequest, NextResponse } from 'next/server'
import { getProjectEnv } from '@/lib/project-env'
import { processSalesLeadSyncOutbox, reconcileSalesLeadsFromMonday } from '@/lib/sales-leads/monday-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Serialize webhook work so Monday "any column change" storms do not stack up. */
let webhookQueue: Promise<void> = Promise.resolve()

function enqueueWebhookWork(work: () => Promise<void>) {
  webhookQueue = webhookQueue
    .then(work)
    .catch(error => {
      console.error('[monday-webhook] background processing failed:', error)
    })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (body.challenge) return NextResponse.json({ challenge: body.challenge })

  const secret = getProjectEnv('SALES_LEAD_MONDAY_WEBHOOK_SECRET')
  if (secret) {
    const provided = req.headers.get('x-cantara-webhook-secret') || req.nextUrl.searchParams.get('secret')
    if (provided !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const itemId = String(body?.event?.pulseId || body?.event?.itemId || body?.pulseId || '')

  // Ack immediately so Monday does not leave dozens of automations "In progress"
  // while we reconcile + research + push drafts back.
  enqueueWebhookWork(async () => {
    const result = await reconcileSalesLeadsFromMonday(itemId || undefined)
    const outbound = await processSalesLeadSyncOutbox()
    console.log('[monday-webhook] processed', {
      itemId: itemId || null,
      examined: result.examined,
      matched: result.matched,
      updated: result.updated,
      outbound,
    })
  })

  return NextResponse.json({ ok: true, accepted: true })
}
