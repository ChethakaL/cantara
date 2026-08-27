import { NextRequest, NextResponse } from 'next/server'
import { getContractSendConfig } from '@/lib/automations/contracts/config'
import { runContractSendAutomation } from '@/lib/automations/contracts/send-contract'
import { createBackgroundQueue, extractMondayPulseId } from '@/lib/automations/monday-webhook'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const enqueue = createBackgroundQueue('contracts-webhook')

/**
 * Monday.com → Cantara: Contract Status "Create Contract" webhook.
 *   POST /api/webhooks/monday/contracts?secret=...
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (body.challenge) return NextResponse.json({ challenge: body.challenge })

  const config = getContractSendConfig()
  if (config.webhookSecret) {
    const provided =
      req.headers.get('x-cantara-webhook-secret') || req.nextUrl.searchParams.get('secret')
    if (provided !== config.webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const itemId = extractMondayPulseId(body)

  enqueue(async () => {
    const result = await runContractSendAutomation({ itemId })
    console.log('[contracts-webhook] result', {
      itemId,
      ok: result.ok,
      dryRun: result.dryRun,
      skipped: result.skipped,
      branch: result.branch,
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
    message:
      'Accepted. Contract-send runs in background. Check server logs; dry-run is on by default.',
  })
}

export async function GET() {
  const config = getContractSendConfig()
  return NextResponse.json({
    ok: true,
    automation: 'contract-send-from-monday',
    boardId: config.boardId,
    dryRun: config.dryRun,
    updateMonday: config.updateMonday,
    templates: {
      ma: config.templates.ma ? 'set' : null,
      consulting: config.templates.consulting ? 'set' : null,
    },
  })
}
