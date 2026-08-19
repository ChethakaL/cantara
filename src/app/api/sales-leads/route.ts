import { NextRequest, NextResponse } from 'next/server'
import {
  SalesLeadCallResult,
  SalesLeadContactType,
  SalesLeadStage,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  ACTIVE_STAGES,
  EXCEPTION_STAGES,
  isIdleLead,
  SalesLeadWorkflowError,
} from '@/lib/sales-leads/workflow'
import {
  recordSalesLeadCall,
  setSalesLeadStage,
  updateSalesLeadFields,
} from '@/lib/sales-leads/service'
import { salesLeadMondayConfiguration, reconcileSalesLeadsFromMonday, processSalesLeadSyncOutbox } from '@/lib/sales-leads/monday-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function errorResponse(error: unknown) {
  if (error instanceof SalesLeadWorkflowError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === 'LEAD_NOT_FOUND' ? 404 : 409 })
  }
  console.error('[sales-leads]', error)
  return NextResponse.json({ error: 'Sales lead operation failed.' }, { status: 500 })
}

function optionalDate(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new SalesLeadWorkflowError('Invalid date value.', 'INVALID_DATE')
  return date
}

export async function GET(req: NextRequest) {
  const syncFromMonday = req.nextUrl.searchParams.get('sync') === 'true'
  let syncSummary: Record<string, unknown> | null = null
  if (syncFromMonday) {
    try {
      const inbound = await reconcileSalesLeadsFromMonday()
      const outbound = await processSalesLeadSyncOutbox()
      syncSummary = { ...inbound, outbound }
      console.log('[sales-leads] Monday sync', syncSummary)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.warn('[sales-leads/route] Sync reconciliation warning:', err)
      syncSummary = { error: message, created: 0, updated: 0 }
    }
  }

  const view = req.nextUrl.searchParams.get('view') || 'active'
  const requestedCallerId = req.nextUrl.searchParams.get('callerId') || undefined
  const state = req.nextUrl.searchParams.get('state') || undefined
  const stage = req.nextUrl.searchParams.get('stage') as SalesLeadStage | null
  const where: any = {}

  let callerId = requestedCallerId
  if (view === 'mine' && !callerId) {
    const email = req.cookies.get('cantara_admin_email')?.value
    if (email) callerId = (await prisma.user.findUnique({ where: { email }, select: { id: true } }))?.id
  }
  if (view === 'active') where.currentStage = { in: [...ACTIVE_STAGES] }
  if (view === 'mine') {
    where.currentStage = { in: [...ACTIVE_STAGES, ...EXCEPTION_STAGES] }
    where.assignedCallerId = callerId || '__unresolved_current_user__'
  }
  if (view === 'warm') {
    where.currentStage = {
      in: [SalesLeadStage.NEEDS_FOLLOW_UP, SalesLeadStage.RECONNECT_LATER, SalesLeadStage.BOOKED],
    }
  }
  if (view === 'idle') where.currentStage = { in: [...ACTIVE_STAGES] }
  if (state) where.state = state
  if (stage && Object.values(SalesLeadStage).includes(stage)) where.currentStage = stage

  const orderBy: any =
    view === 'idle'
      ? [{ lastContactDate: 'asc' }, { businessName: 'asc' }]
      : [{ nextActionDate: 'asc' }, { currentStage: 'asc' }, { assignedCallerId: 'asc' }]
  const leads = await prisma.salesLead.findMany({
    where,
    include: { assignedCaller: { select: { id: true, name: true, email: true } } },
    orderBy,
  })
  const filtered = view === 'idle' ? leads.filter(lead => isIdleLead(lead.lastContactDate)) : leads
  const now = new Date()
  const globalActiveWhere = { currentStage: { in: [...ACTIVE_STAGES] } }
  const [activeCount, dueCount, warmCount, activeForIdle] = await Promise.all([
    prisma.salesLead.count({ where: globalActiveWhere }),
    prisma.salesLead.count({
      where: { ...globalActiveWhere, nextActionDate: { lte: now } },
    }),
    prisma.salesLead.count({
      where: {
        currentStage: {
          in: [SalesLeadStage.NEEDS_FOLLOW_UP, SalesLeadStage.RECONNECT_LATER, SalesLeadStage.BOOKED],
        },
      },
    }),
    prisma.salesLead.findMany({
      where: globalActiveWhere,
      select: { lastContactDate: true },
    }),
  ])
  const stats = {
    active: activeCount,
    due: dueCount,
    warm: warmCount,
    idle: activeForIdle.filter(lead => isIdleLead(lead.lastContactDate)).length,
  }
  const callers = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ leads: filtered, callers, stats, sync: syncSummary })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const businessName = String(body.businessName || '').trim()
    if (!businessName) {
      return NextResponse.json({ error: 'Business name is required.' }, { status: 400 })
    }
    const currentStage =
      body.currentStage && Object.values(SalesLeadStage).includes(body.currentStage)
        ? body.currentStage
        : SalesLeadStage.NEW
    const lead = await prisma.$transaction(async tx => {
      const created = await tx.salesLead.create({
        data: {
          businessName,
          assignedCallerId: body.assignedCallerId || null,
          currentStage,
          nextActionDate: optionalDate(body.nextActionDate),
          state: body.state || null,
          city: body.city || null,
          websiteUrl: body.websiteUrl || null,
          googleRating: body.googleRating == null ? null : Number(body.googleRating),
          reviewCount: body.reviewCount == null ? null : Number(body.reviewCount),
          sqftIndoor: body.sqftIndoor == null ? null : Number(body.sqftIndoor),
          sqftOutdoor: body.sqftOutdoor == null ? null : Number(body.sqftOutdoor),
          sqftCombined: body.sqftCombined == null ? null : Number(body.sqftCombined),
          locationType: body.locationType || null,
          preCallBriefUrl: body.preCallBriefUrl || null,
          ownerFirstName: body.ownerFirstName || null,
          ownerLastName: body.ownerLastName || null,
          ownerPhone: body.ownerPhone || null,
          phoneType:
            body.phoneType === SalesLeadContactType.DIRECT
              ? SalesLeadContactType.DIRECT
              : SalesLeadContactType.GENERAL,
          sourceLinkPhone: body.sourceLinkPhone || null,
          ownerEmail: body.ownerEmail || null,
          emailType:
            body.emailType === SalesLeadContactType.DIRECT
              ? SalesLeadContactType.DIRECT
              : SalesLeadContactType.GENERAL,
          sourceLinkEmail: body.sourceLinkEmail || null,
          notes: body.notes || null,
        },
      })
      await tx.salesLeadActivity.create({
        data: { leadId: created.id, type: 'created', summary: 'Lead created in Cantara Next.' },
      })
      return created
    })

    // Queue creation of the corresponding Monday item. The sync worker will
    // create the item when the configured board/mapping is available.
    const mondayConfig = await salesLeadMondayConfiguration()
    if (mondayConfig.boardId && Object.keys(mondayConfig.mapping).length > 0) {
      await prisma.salesLeadSyncEvent.create({
        data: {
          leadId: lead.id,
          direction: 'OUTBOUND_MONDAY',
          status: 'PENDING',
          payload: { reason: 'lead_created' },
        },
      })
    }
    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: 'Lead id is required.' }, { status: 400 })

    if (body.lastCallResult) {
      return NextResponse.json(
        await recordSalesLeadCall({
          id,
          result: body.lastCallResult as SalesLeadCallResult,
          disposition: body.disposition || body.currentStage,
          callbackDate: optionalDate(body.callbackDate || body.nextActionDate),
        }),
      )
    }

    // 1. Update any editable fields (notes, caller, business details)
    const data: any = {}
    const editable = [
      'businessName', 'state', 'city', 'websiteUrl', 'googleRating',
      'reviewCount', 'sqftIndoor', 'sqftOutdoor', 'sqftCombined', 'locationType',
      'preCallBriefUrl', 'ownerFirstName', 'ownerLastName', 'ownerPhone', 'phoneType',
      'sourceLinkPhone', 'ownerEmail', 'emailType', 'sourceLinkEmail', 'notes',
    ]
    for (const key of editable) {
      if (body[key] !== undefined) data[key] = body[key] === '' ? null : body[key]
    }
    if (body.assignedCallerId !== undefined) {
      const callerIdStr = String(body.assignedCallerId || '').trim()
      data.assignedCaller = callerIdStr
        ? { connect: { id: callerIdStr } }
        : { disconnect: true }
    }
    if (body.stageStartDate !== undefined) data.stageStartDate = optionalDate(body.stageStartDate)

    let updatedLead = null
    if (Object.keys(data).length > 0) {
      updatedLead = await updateSalesLeadFields(id, data)
    }

    // 2. Update currentStage if provided
    if (body.currentStage) {
      const existing = await prisma.salesLead.findUnique({ where: { id }, select: { currentStage: true } })
      if (existing && existing.currentStage !== body.currentStage) {
        updatedLead = await setSalesLeadStage({
          id,
          stage: body.currentStage as SalesLeadStage,
          nextActionDate: optionalDate(body.nextActionDate),
          bookingDateTime: optionalDate(body.bookingDateTime),
          allowRestart: body.allowRestart === true,
        })
      }
    }

    if (!updatedLead) {
      updatedLead = await prisma.salesLead.findUnique({ where: { id } })
    }

    // Complete the outbound update before returning so the UI can safely show the
    // processing indicator as finished only after Monday has the new values.
    await processSalesLeadSyncOutbox().catch(err => console.warn('[sales-leads/route] Immediate outbox warning:', err))

    return NextResponse.json(updatedLead)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Lead id is required.' }, { status: 400 })
    const existing = await prisma.salesLead.findUnique({
      where: { id },
      select: { id: true, mondayItemId: true, mondayBoardId: true },
    })
    if (!existing) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })

    if (existing.mondayItemId && existing.mondayBoardId === '18424022169') {
      const { executeMondayTool } = await import('@/lib/composio')
      await executeMondayTool('MONDAY_DELETE_ITEM', { item_id: existing.mondayItemId }).catch((err) =>
        console.warn('[Delete Lead] Monday delete warning:', err)
      )
    }

    await prisma.salesLeadSyncEvent.deleteMany({ where: { leadId: id } }).catch(() => null)
    await prisma.salesLead.delete({ where: { id } })

    return NextResponse.json({ deleted: true, id })
  } catch (error) {
    return errorResponse(error)
  }
}
