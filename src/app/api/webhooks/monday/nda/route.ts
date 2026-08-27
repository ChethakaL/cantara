import { NextRequest, NextResponse } from 'next/server'
import { getNdaSendConfig } from '@/lib/automations/nda/config'
import { runNdaSendAutomation } from '@/lib/automations/nda/send-nda'
import { createBackgroundQueue, extractMondayPulseId } from '@/lib/automations/monday-webhook'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const enqueue = createBackgroundQueue('nda-webhook')

/**
 * Monday.com → Cantara: NDA Status "Send NDA" webhook.
 *   POST /api/webhooks/monday/nda?secret=...
 *
 * Dry-run is ON by default — no live DocuSign send or Monday writes unless env flags allow.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (body.challenge) return NextResponse.json({ challenge: body.challenge })

  const config = getNdaSendConfig()
  if (config.webhookSecret) {
    const provided =
      req.headers.get('x-cantara-webhook-secret') || req.nextUrl.searchParams.get('secret')
    if (provided !== config.webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const itemId = extractMondayPulseId(body)

  enqueue(async () => {
    const result = await runNdaSendAutomation({ itemId })
    console.log('[nda-webhook] result', {
      itemId,
      ok: result.ok,
      dryRun: result.dryRun,
      skipped: result.skipped,
      envelopeId: result.envelopeId,
      reason: result.reason,
      error: result.error,
    })
  })

  return NextResponse.json({
    ok: true,
    accepted: true,
    itemId: itemId || null,
    dryRunDefault: config.dryRun,
    message: 'Accepted. NDA-send runs in background. Check server logs; dry-run is on by default.',
  })
}

export async function GET() {
  const config = getNdaSendConfig()
  return NextResponse.json({
    ok: true,
    automation: 'nda-send-from-monday',
    boardId: config.boardId,
    dryRun: config.dryRun,
    updateMonday: config.updateMonday,
    templateId: config.templateId,
    statusLabels: config.statusLabels,
  })
}
