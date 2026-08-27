import { NextRequest, NextResponse } from 'next/server'
import { getTeaserApproveConfig } from '@/lib/automations/teaser-approve/config'
import { runTeaserApproveAutomation } from '@/lib/automations/teaser-approve/send-teaser-nda'
import {
  createBackgroundQueue,
  extractMondayBoardId,
  extractMondayPulseId,
} from '@/lib/automations/monday-webhook'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const enqueue = createBackgroundQueue('teaser-approve-webhook')

/**
 * Monday.com → Cantara: Teaser Draft Status “Approved”
 *   POST /api/webhooks/monday/teaser-approve?secret=...
 *
 * Uses webhook event.boardId + event.pulseId (dynamic — no deleted board default).
 * Dry-run ON by default.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (body.challenge) return NextResponse.json({ challenge: body.challenge })

  const config = getTeaserApproveConfig()
  if (config.webhookSecret) {
    const provided =
      req.headers.get('x-cantara-webhook-secret') || req.nextUrl.searchParams.get('secret')
    if (provided !== config.webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const itemId = extractMondayPulseId(body)
  const boardId = extractMondayBoardId(body)
  const origin = req.nextUrl.origin

  enqueue(async () => {
    const result = await runTeaserApproveAutomation({ itemId, boardId, origin })
    console.log('[teaser-approve-webhook] result', {
      itemId,
      boardId,
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
    boardId: boardId || null,
    dryRunDefault: config.dryRun,
    message:
      'Accepted. Teaser-approve runs in background. Dry-run is on by default (no live email/DocuSign).',
  })
}

export async function GET() {
  const config = getTeaserApproveConfig()
  return NextResponse.json({
    ok: true,
    automation: 'teaser-approve-send-to-buyer',
    boardIdFallback: config.boardIdFallback,
    dryRun: config.dryRun,
    updateMonday: config.updateMonday,
    sendEmail: config.sendEmail,
    templateId: config.templateId,
    columns: config.columns,
    note: 'Board ID comes from webhook event.boardId (dynamic).',
  })
}
