import { NextRequest, NextResponse } from 'next/server'
import { getBuyerNdaSignedConfig } from '@/lib/automations/nda/buyer-signed-config'
import { runBuyerNdaSignedAutomation } from '@/lib/automations/nda/buyer-signed'
import { createBackgroundQueue } from '@/lib/automations/monday-webhook'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const enqueue = createBackgroundQueue('docusign-buyer-nda-webhook')

/**
 * DocuSign Connect → prospective buyer NDA recipient-completed.
 *   POST /api/webhooks/docusign/buyer-nda
 *
 * Dry-run ON by default. Does not create envelopes — archives signed PDF to Monday.
 */
export async function POST(req: NextRequest) {
  const config = getBuyerNdaSignedConfig()
  if (config.webhookSecret) {
    const provided =
      req.headers.get('x-cantara-webhook-secret') || req.nextUrl.searchParams.get('secret')
    if (req.nextUrl.searchParams.get('secret') && provided !== config.webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const contentType = req.headers.get('content-type') || ''
  let payload: unknown = {}
  if (contentType.includes('application/json')) {
    payload = await req.json().catch(() => ({}))
  } else {
    const text = await req.text()
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { raw: text }
    }
  }

  enqueue(async () => {
    const result = await runBuyerNdaSignedAutomation({ payload })
    console.log('[docusign-buyer-nda-webhook] result', {
      ok: result.ok,
      dryRun: result.dryRun,
      skipped: result.skipped,
      envelopeId: result.envelopeId,
      mondayItemId: result.mondayItemId,
      reason: result.reason,
      error: result.error,
    })
  })

  return NextResponse.json({
    received: true,
    accepted: true,
    dryRunDefault: config.dryRun,
    message: 'Accepted. Buyer NDA signed automation runs in background; dry-run is on by default.',
  })
}

export async function GET() {
  const config = getBuyerNdaSignedConfig()
  return NextResponse.json({
    ok: true,
    automation: 'buyer-nda-signed-from-docusign',
    boardId: config.boardId,
    fileColumnId: config.columns.file,
    dryRun: config.dryRun,
    updateMonday: config.updateMonday,
    resolveOrder: [
      'webhook monday.boardId + monday.itemId',
      'AutomationBuyerNdaPending by envelopeId',
      'BUYERS_NDA_MONDAY_BOARD_ID + envelope column search',
    ],
    note: 'No deleted Make board default. DocuSign cannot supply Monday board IDs.',
  })
}
