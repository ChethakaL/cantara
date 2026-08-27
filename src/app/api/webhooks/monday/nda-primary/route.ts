import { NextRequest, NextResponse } from 'next/server'
import { getNdaPrimaryContactConfig } from '@/lib/automations/nda/primary-contact-config'
import { runNdaPrimaryContactAutomation } from '@/lib/automations/nda/track-primary-contact'
import { createBackgroundQueue, extractMondayPulseId } from '@/lib/automations/monday-webhook'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const enqueue = createBackgroundQueue('nda-primary-webhook')

/**
 * Monday.com → Cantara: NDA Status "Send NDA" on transaction/deal → track primary contact.
 *   POST /api/webhooks/monday/nda-primary?secret=...
 *
 * Uses existing Prospective NDA Envelope ID (no new DocuSign template/send).
 * Dry-run ON by default.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (body.challenge) return NextResponse.json({ challenge: body.challenge })

  const config = getNdaPrimaryContactConfig()
  if (config.webhookSecret) {
    const provided =
      req.headers.get('x-cantara-webhook-secret') || req.nextUrl.searchParams.get('secret')
    if (provided !== config.webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const itemId = extractMondayPulseId(body)

  enqueue(async () => {
    const result = await runNdaPrimaryContactAutomation({ itemId })
    console.log('[nda-primary-webhook] result', {
      itemId,
      ok: result.ok,
      dryRun: result.dryRun,
      skipped: result.skipped,
      envelopeId: result.envelopeId,
      primaryCompleted: result.primaryCompleted,
      reason: result.reason,
      error: result.error,
    })
  })

  return NextResponse.json({
    ok: true,
    accepted: true,
    itemId: itemId || null,
    dryRunDefault: config.dryRun,
    message:
      'Accepted. NDA primary-contact tracking runs in background. Dry-run is on by default.',
  })
}

export async function GET() {
  const config = getNdaPrimaryContactConfig()
  return NextResponse.json({
    ok: true,
    automation: 'nda-primary-contact-from-monday',
    boardId: config.boardId,
    dryRun: config.dryRun,
    updateMonday: config.updateMonday,
    statusLabels: config.statusLabels,
  })
}
