import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest, { params }: { params: { clientId: string } }) {
  const { clientId } = params
  const section = req.nextUrl.searchParams.get('section')
  if (!clientId || !section) return new Response('clientId and section required', { status: 400 })

  const client = await (prisma as any).clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })

  const data = (client?.sectionSubmissions as Record<string, any>) ?? {}
  return NextResponse.json(data[section] ?? null)
}

export async function PUT(req: NextRequest, { params }: { params: { clientId: string } }) {
  const { clientId } = params
  const { section, data } = await req.json()
  if (!clientId || !section) return new Response('clientId and section required', { status: 400 })

  const client = await (prisma as any).clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })

  const existing = (client?.sectionSubmissions as Record<string, any>) ?? {}
  existing[section] = data

  await (prisma as any).clientProfile.update({
    where: { id: clientId },
    data: { sectionSubmissions: existing },
  })

  return NextResponse.json({ ok: true })
}
