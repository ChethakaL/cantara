import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  CHECKLIST_SUBMISSION_KEY,
  ROADMAP_SUBMISSION_KEY,
  createChecklistItem,
  extractSaleReadinessChecklist,
  readChecklistSubmission,
  readRoadmapSubmission,
  type SaleReadinessChecklistItem,
} from '@/lib/sale-readiness-checklist'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  const approvedOnly = req.nextUrl.searchParams.get('approvedOnly') === '1'
  if (!clientId) {
    return new Response('clientId required', { status: 400 })
  }

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true, businessName: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, any>
  let state = readChecklistSubmission(submissions)
  if (!state) {
    const roadmap = readRoadmapSubmission(submissions)
    if (roadmap?.markdown) {
      const items = extractSaleReadinessChecklist(roadmap.markdown, Array.isArray(roadmap.checklist) ? roadmap.checklist : [])
      if (items.length) {
        state = {
          workstream: 'sales-readiness',
          clientName: roadmap.clientName ?? client.businessName ?? 'Client',
          generatedAt: roadmap.generatedAt ?? new Date().toISOString(),
          items,
        }
        await prisma.clientProfile.update({
          where: { id: clientId },
          data: {
            sectionSubmissions: {
              ...submissions,
              [CHECKLIST_SUBMISSION_KEY]: state,
              [ROADMAP_SUBMISSION_KEY]: { ...roadmap, checklist: items },
            },
          },
        })
      }
    }
  }
  const items = Array.isArray(state?.items) ? state.items : []

  return NextResponse.json({
    checklist: state
      ? {
          ...state,
          clientName: state.clientName ?? client.businessName ?? 'Client',
          items: approvedOnly ? items.filter((item: any) => item.advisorApproved) : items,
        }
      : null,
  })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const clientId = String(body.clientId || '')
  const itemId = String(body.itemId || '')
  if (!clientId || (!itemId && !Array.isArray(body.items))) {
    return new Response('clientId and itemId or items required', { status: 400 })
  }

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, any>
  const state = readChecklistSubmission(submissions)
  if (!state || !Array.isArray(state.items)) {
    return new Response('Checklist not found', { status: 404 })
  }

  const now = new Date().toISOString()
  let items: SaleReadinessChecklistItem[] = Array.isArray(state.items) ? state.items : []

  if (Array.isArray(body.items)) {
    items = body.items.map((raw: any) => createChecklistItem(raw))
  } else if (itemId === 'new') {
    items = [
      ...items,
      createChecklistItem({
        category: body.category || 'New category',
        item: body.item || 'New checklist item',
        status: body.status || '🟡 YELLOW',
        actionNeeded: body.actionNeeded || '',
      }),
    ]
  } else if (body.delete === true) {
    const before = items.length
    items = items.filter(item => item.id !== itemId)
    if (items.length === before) return new Response('Checklist item not found', { status: 404 })
  } else if (itemId === 'all') {
    items = state.items.map((item: any) => ({
      ...item,
      advisorApproved: true,
      approvedAt: now,
    }))
  } else {
    let found = false
    items = state.items.map((item: any) => {
      if (item.id !== itemId) return item
      found = true
      const next = { ...item }
      if (typeof body.advisorApproved === 'boolean') {
        next.advisorApproved = body.advisorApproved
        next.approvedAt = body.advisorApproved ? now : null
        if (!body.advisorApproved) {
          next.clientCompleted = false
          next.clientCompletedAt = null
        }
      }
      if (typeof body.category === 'string') next.category = body.category.trim()
      if (typeof body.item === 'string') next.item = body.item.trim()
      if (typeof body.status === 'string') next.status = body.status.trim() || next.status
      if (typeof body.actionNeeded === 'string') next.actionNeeded = body.actionNeeded.trim()
      if (typeof body.clientCompleted === 'boolean') {
        if (!next.advisorApproved) return next
        next.clientCompleted = body.clientCompleted
        next.clientCompletedAt = body.clientCompleted ? now : null
      }
      return next
    })
    if (!found) return new Response('Checklist item not found', { status: 404 })
  }

  const nextState = { ...state, workstream: 'sales-readiness', items, updatedAt: now }
  const roadmap = readRoadmapSubmission(submissions)
  await prisma.clientProfile.update({
    where: { id: clientId },
    data: {
      sectionSubmissions: {
        ...submissions,
        [CHECKLIST_SUBMISSION_KEY]: nextState,
        ...(roadmap ? { [ROADMAP_SUBMISSION_KEY]: { ...roadmap, checklist: items } } : {}),
      },
    },
  })

  return NextResponse.json({ checklist: nextState })
}
