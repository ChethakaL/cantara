import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const MAX_DRAFT_BYTES = 12 * 1024 * 1024

function draftPayloadSize(documents: Array<{ base64?: string }>) {
  return documents.reduce((sum, doc) => sum + (doc.base64?.length ?? 0), 0)
}

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, unknown>

  return NextResponse.json({ draft: submissions.taxLiabilityDraft ?? null })
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const clientId = String(body.clientId || '')
  const documents = Array.isArray(body.documents) ? body.documents : []

  if (!clientId) return new Response('clientId required', { status: 400 })
  if (draftPayloadSize(documents) > MAX_DRAFT_BYTES) {
    return new Response('Draft is too large to auto-save. Remove a file or analyze now.', { status: 413 })
  }

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const current = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, unknown>

  current.taxLiabilityDraft = {
    documents,
    savedAt: new Date().toISOString(),
  }

  await prisma.clientProfile.update({
    where: { id: clientId },
    data: { sectionSubmissions: current as any },
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const current = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, unknown>
  delete current.taxLiabilityDraft

  await prisma.clientProfile.update({
    where: { id: clientId },
    data: { sectionSubmissions: current as any },
  })

  return NextResponse.json({ ok: true })
}
