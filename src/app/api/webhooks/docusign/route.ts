import { NextRequest, NextResponse } from 'next/server'
import { getEnvelopeCompletedConfig } from '@/lib/automations/docusign/envelope-completed-config'
import { runEnvelopeCompletedAutomation } from '@/lib/automations/docusign/envelope-completed'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

let webhookQueue: Promise<void> = Promise.resolve()

function enqueue(work: () => Promise<void>) {
  webhookQueue = webhookQueue.then(work).catch(error => {
    console.error('[docusign-webhook] background failed:', error)
  })
}

/**
 * DocuSign Connect listener (Make replacement for envelope completed).
 * Point DocuSign Connect / completed webhook here:
 *   POST /api/webhooks/docusign
 */
export async function POST(req: NextRequest) {
  const config = getEnvelopeCompletedConfig()
  if (config.webhookSecret) {
    const provided =
      req.headers.get('x-cantara-webhook-secret') ||
      req.headers.get('x-docusign-signature-1') ||
      req.nextUrl.searchParams.get('secret')
    // HMAC verification can be added later; shared secret query/header is enough for staging.
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

  // Ack immediately — DocuSign Connect retries aggressively on slow responses.
  enqueue(async () => {
    const result = await runEnvelopeCompletedAutomation({ payload })
    console.log('[docusign-webhook] envelope-completed', {
      ok: result.ok,
      dryRun: result.dryRun,
      skipped: result.skipped,
      envelopeId: result.envelopeId,
      kind: result.documentKind,
      mondayItemId: result.mondayItemId,
      reason: result.reason,
      error: result.error,
    })
  })

  return NextResponse.json({ received: true, accepted: true, dryRunDefault: config.dryRun })
}

export async function GET() {
  const config = getEnvelopeCompletedConfig()
  return NextResponse.json({
    ok: true,
    automation: 'docusign-envelope-completed',
    boardId: config.dealsBoardId,
    dryRun: config.dryRun,
    updateMonday: config.updateMonday,
    message: 'DocuSign Connect webhook listener is ready. Use POST for events.',
  })
}
