import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractSaleReadinessChecklist } from '@/lib/sale-readiness-checklist'

export const dynamic = 'force-dynamic'

function checklistKey(workstream: string) {
  return `saleReadinessChecklist_${workstream}`
}

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  const workstream = req.nextUrl.searchParams.get('workstream')
  const approvedOnly = req.nextUrl.searchParams.get('approvedOnly') === '1'
  if (!clientId || !workstream || !['ws1', 'ws2'].includes(workstream)) {
    return new Response('clientId and workstream required', { status: 400 })
  }

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true, businessName: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, any>
  let state = submissions[checklistKey(workstream)] ?? null
  if (!state) {
    const roadmap = submissions[`improvementRoadmap_${workstream}`]
    if (roadmap?.markdown) {
      const items = extractSaleReadinessChecklist(roadmap.markdown, Array.isArray(roadmap.checklist) ? roadmap.checklist : [])
      if (items.length) {
        state = {
          workstream,
          clientName: roadmap.clientName ?? client.businessName ?? 'Client',
          generatedAt: roadmap.generatedAt ?? new Date().toISOString(),
          items,
        }
        await prisma.clientProfile.update({
          where: { id: clientId },
          data: {
            sectionSubmissions: {
              ...submissions,
              [checklistKey(workstream)]: state,
              [`improvementRoadmap_${workstream}`]: { ...roadmap, checklist: items },
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
  const workstream = String(body.workstream || '')
  const itemId = String(body.itemId || '')
  if (!clientId || !['ws1', 'ws2'].includes(workstream) || !itemId) {
    return new Response('clientId, workstream, and itemId required', { status: 400 })
  }

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, any>
  const key = checklistKey(workstream)
  const state = submissions[key]
  if (!state || !Array.isArray(state.items)) {
    return new Response('Checklist not found', { status: 404 })
  }

  const now = new Date().toISOString()
  let items = []

  if (itemId === 'all') {
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
      if (typeof body.clientCompleted === 'boolean') {
        if (!next.advisorApproved) return next
        next.clientCompleted = body.clientCompleted
        next.clientCompletedAt = body.clientCompleted ? now : null
      }
      return next
    })
    if (!found) return new Response('Checklist item not found', { status: 404 })
  }

  const nextState = { ...state, items, updatedAt: now }
  await prisma.clientProfile.update({
    where: { id: clientId },
    data: {
      sectionSubmissions: {
        ...submissions,
        [key]: nextState,
      },
    },
  })

  return NextResponse.json({ checklist: nextState })
}
