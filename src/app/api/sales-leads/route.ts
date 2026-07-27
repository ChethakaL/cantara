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

export const dynamic = 'force-dynamic'

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
  const view = req.nextUrl.searchParams.get('view') || 'active'
  const requestedCallerId = req.nextUrl.searchParams.get('callerId') || undefined
  const state = req.nextUrl.searchParams.get('state') || undefined
  const stage = req.nextUrl.searchParams.get('stage') as SalesLeadStage | null
  const where: any = {}

  let callerId = requestedCallerId
  if (view === 'mine' && !callerId) {
    const email = req.cookies.get('cantara_admin_email')?.value
    if (email) {
      callerId = (await prisma.user.findUnique({ where: { email }, select: { id: true } }))?.id
    }
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
  const callers = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ leads: filtered, callers })
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
    if (body.currentStage) {
      return NextResponse.json(
        await setSalesLeadStage({
          id,
          stage: body.currentStage as SalesLeadStage,
          nextActionDate: optionalDate(body.nextActionDate),
          bookingDateTime: optionalDate(body.bookingDateTime),
          allowRestart: body.allowRestart === true,
        }),
      )
    }

    const data: any = {}
    const editable = [
      'businessName', 'assignedCallerId', 'state', 'city', 'websiteUrl', 'googleRating',
      'reviewCount', 'sqftIndoor', 'sqftOutdoor', 'sqftCombined', 'locationType',
      'preCallBriefUrl', 'ownerFirstName', 'ownerLastName', 'ownerPhone', 'phoneType',
      'sourceLinkPhone', 'ownerEmail', 'emailType', 'sourceLinkEmail', 'notes',
    ]
    for (const key of editable) {
      if (body[key] !== undefined) data[key] = body[key] === '' ? null : body[key]
    }
    return NextResponse.json(await updateSalesLeadFields(id, data))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Lead id is required.' }, { status: 400 })
  const existing = await prisma.salesLead.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 })
  await prisma.salesLead.delete({ where: { id } })
  return NextResponse.json({ deleted: true, id })
}
