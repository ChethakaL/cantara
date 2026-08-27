import { NextRequest, NextResponse } from 'next/server'
import { getCatalogAutomation } from '@/lib/automations/catalog'
import { runContractSendAutomation } from '@/lib/automations/contracts/send-contract'
import { runNdaSendAutomation } from '@/lib/automations/nda/send-nda'
import { runNdaPrimaryContactAutomation } from '@/lib/automations/nda/track-primary-contact'
import { runBuyerNdaSignedAutomation } from '@/lib/automations/nda/buyer-signed'
import { runTeaserApproveAutomation } from '@/lib/automations/teaser-approve/send-teaser-nda'
import { runEmbeddedSigning } from '@/lib/automations/docusign/embedded-signing'
import { runEnvelopeCompletedAutomation } from '@/lib/automations/docusign/envelope-completed'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function mondayItemIdFromBody(body: any) {
  return String(body.itemId || body.pulseId || '').trim()
}

function mondayBoardIdFromBody(body: any) {
  return String(body.boardId || '').trim() || null
}

/** Dry-run / diagnose a catalog automation without external systems calling us. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const params = await Promise.resolve(ctx.params)
  const automation = getCatalogAutomation(params.id)
  if (!automation) {
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const forceLive = Boolean(body.forceLive)
  const origin = req.nextUrl.origin

  if (
    automation.handlerKey === 'contract_send' ||
    automation.handlerKey === 'nda_send' ||
    automation.handlerKey === 'nda_primary_contact'
  ) {
    const itemId = mondayItemIdFromBody(body)
    if (!itemId) {
      return NextResponse.json(
        { error: 'Provide itemId (Monday pulse id) to simulate the webhook' },
        { status: 400 }
      )
    }
    const result =
      automation.handlerKey === 'contract_send'
        ? await runContractSendAutomation({ itemId, forceLive })
        : automation.handlerKey === 'nda_send'
          ? await runNdaSendAutomation({ itemId, forceLive })
          : await runNdaPrimaryContactAutomation({ itemId, forceLive })
    return NextResponse.json({ automationId: automation.id, result })
  }

  if (automation.handlerKey === 'teaser_approve') {
    const itemId = mondayItemIdFromBody(body)
    const boardId = mondayBoardIdFromBody(body)
    if (!itemId) {
      return NextResponse.json(
        { error: 'Provide itemId (Monday pulse id) to simulate the webhook' },
        { status: 400 }
      )
    }
    if (!boardId) {
      return NextResponse.json(
        { error: 'Provide boardId (Monday board id from webhook event.boardId)' },
        { status: 400 }
      )
    }
    const result = await runTeaserApproveAutomation({ itemId, boardId, forceLive, origin })
    return NextResponse.json({ automationId: automation.id, result })
  }

  if (automation.handlerKey === 'buyer_nda_signed') {
    const envelopeId = String(body.envelopeId || '').trim()
    if (!envelopeId) {
      return NextResponse.json(
        { error: 'Provide envelopeId to simulate DocuSign recipient-completed webhook' },
        { status: 400 }
      )
    }
    const result = await runBuyerNdaSignedAutomation({
      forceLive,
      envelopeId,
      payload: {
        event: 'recipient-completed',
        data: {
          envelopeId,
          recipientId: body.recipientId || '1',
          accountId: body.accountId,
        },
      },
    })
    return NextResponse.json({ automationId: automation.id, result })
  }

  if (automation.handlerKey === 'embedded_signing') {
    const envelopeId = String(body.envelopeId || body.envelope || '').trim()
    if (!envelopeId) {
      return NextResponse.json(
        { error: 'Provide envelope (DocuSign envelope id) to simulate the signing link' },
        { status: 400 }
      )
    }
    const result = await runEmbeddedSigning({
      envelopeId,
      role: String(body.role || 'Client'),
      boardId: body.boardId || null,
      itemId: body.itemId || null,
      forceLive,
    })
    return NextResponse.json({ automationId: automation.id, result })
  }

  if (automation.handlerKey === 'envelope_completed') {
    const envelopeId = String(body.envelopeId || '').trim()
    if (!envelopeId) {
      return NextResponse.json(
        { error: 'Provide envelopeId to simulate DocuSign completed webhook' },
        { status: 400 }
      )
    }
    const result = await runEnvelopeCompletedAutomation({
      forceLive,
      envelopeId,
      documentKind: body.documentKind,
      payload: {
        event: 'envelope-completed',
        data: {
          envelopeId,
          envelopeStatus: 'completed',
        },
      },
    })
    return NextResponse.json({ automationId: automation.id, result })
  }

  return NextResponse.json({ error: 'No test handler for this automation' }, { status: 400 })
}
