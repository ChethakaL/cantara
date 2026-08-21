import { NextRequest, NextResponse } from 'next/server'
import { SalesLeadCallResult, SalesLeadStage } from '@prisma/client'
import {
  approveSalesLeadEmail,
  rejectSalesLeadEmail,
  requestSalesLeadEmailApproval,
  recordSalesLeadCall,
  setSalesLeadStage,
} from '@/lib/sales-leads/service'
import { processSalesLeadSyncOutbox } from '@/lib/sales-leads/monday-sync'
import { SalesLeadWorkflowError } from '@/lib/sales-leads/workflow'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function asDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new SalesLeadWorkflowError('Invalid date value.', 'INVALID_DATE')
  return date
}

async function withImmediateMondayPush<T>(result: T) {
  await processSalesLeadSyncOutbox().catch(err =>
    console.warn('[sales-leads/actions] Immediate Monday outbox warning:', err),
  )
  return result
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const body = await req.json()
    const actor = String(body.actor || 'Admin')
    if (body.action === 'request-email-approval') return NextResponse.json(await requestSalesLeadEmailApproval(id, body.template === 2 ? 2 : 1))
    if (body.action === 'approve-email') {
      return NextResponse.json(await withImmediateMondayPush(await approveSalesLeadEmail(id, actor, body.recipients)))
    }
    if (body.action === 'reject-email') return NextResponse.json(await rejectSalesLeadEmail(id, actor))
    if (body.action === 'record-call') {
      return NextResponse.json(await withImmediateMondayPush(await recordSalesLeadCall({
        id,
        result: body.result as SalesLeadCallResult,
        disposition: body.disposition as SalesLeadStage | undefined,
        callbackDate: asDate(body.callbackDate),
      })))
    }
    if (body.action === 'change-stage') {
      return NextResponse.json(await withImmediateMondayPush(await setSalesLeadStage({
        id,
        stage: body.stage as SalesLeadStage,
        nextActionDate: asDate(body.nextActionDate),
        bookingDateTime: asDate(body.bookingDateTime),
        allowRestart: body.allowRestart === true,
      })))
    }
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (error) {
    if (error instanceof SalesLeadWorkflowError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Sales lead action failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
