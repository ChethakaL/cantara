import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function getCurrentAdmin() {
  const emailRaw = cookies().get('cantara_admin_email')?.value || ''
  let email = emailRaw
  try {
    email = decodeURIComponent(emailRaw).trim().toLowerCase()
  } catch {
    email = emailRaw.trim().toLowerCase()
  }
  if (!email) return null
  return prisma.user.findFirst({
    where: { email, role: 'ADMIN' },
    select: { id: true, name: true, email: true, emailFooterName: true, emailFooterTitle: true, emailFooterPhone: true },
  })
}

export async function GET() {
  const currentUser = await getCurrentAdmin()
  if (!currentUser) {
    return NextResponse.json({ assets: [], users: [], currentUserId: null })
  }
  const assets = await prisma.outreachAsset.findMany({
    where: { senderUserId: currentUser.id },
    include: { senderUser: { select: { id: true, name: true, email: true } } },
    orderBy: [{ assetType: 'asc' }, { touch: 'asc' }, { contactType: 'asc' }, { version: 'desc' }],
  })
  return NextResponse.json({
    assets,
    users: [currentUser],
    currentUserId: currentUser.id,
  })
}

export async function PATCH(req: NextRequest) {
  const currentUser = await getCurrentAdmin()
  if (!currentUser) return NextResponse.json({ error: 'Sign in before saving footer settings.' }, { status: 401 })
  const body = await req.json()
  const text = (value: unknown) => String(value ?? '').trim() || null
  const user = await prisma.user.update({
    where: { id: currentUser.id },
    data: { emailFooterName: text(body.name), emailFooterTitle: text(body.title), emailFooterPhone: text(body.phone) },
    select: { id: true, name: true, email: true, emailFooterName: true, emailFooterTitle: true, emailFooterPhone: true },
  })
  return NextResponse.json({ user })
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentAdmin()
  if (!currentUser) {
    return NextResponse.json({ error: 'Sign in before saving templates.' }, { status: 401 })
  }
  const body = await req.json()
  const optionalText = (value: unknown) => {
    const text = value == null ? '' : String(value).trim()
    return text || null
  }
  const data = {
    senderUserId: currentUser.id,
    touch: Number(body.touch) === 2 ? 2 : 1,
    contactType: body.contactType === 'DIRECT' ? 'DIRECT' as const : 'GENERAL' as const,
    assetType: body.assetType === 'CALL' ? 'CALL' as const : 'EMAIL' as const,
    subject: body.subject ? String(body.subject) : null,
    body: String(body.body || ''),
    senderDisplayName: null,
    calendarUrl: optionalText(body.calendarUrl),
    senderPhone: optionalText(body.senderPhone),
    guideUrl: optionalText(body.guideUrl),
    version: Number(body.version) || 1,
    active: body.active !== false,
  }
  if (!data.body.trim()) return NextResponse.json({ error: 'Asset body is required.' }, { status: 400 })
  if (body.id) {
    const existing = await prisma.outreachAsset.findUnique({
      where: { id: String(body.id) },
      select: { senderUserId: true },
    })
    if (!existing || existing.senderUserId !== currentUser.id) {
      return NextResponse.json({ error: 'Template not found.' }, { status: 404 })
    }
  }
  const asset = body.id
    ? await prisma.outreachAsset.update({ where: { id: String(body.id) }, data })
    : await prisma.outreachAsset.create({ data })
  return NextResponse.json({ asset })
}

export async function DELETE(req: NextRequest) {
  const currentUser = await getCurrentAdmin()
  if (!currentUser) {
    return NextResponse.json({ error: 'Sign in before deleting templates.' }, { status: 401 })
  }
  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Asset id is required.' }, { status: 400 })
  }
  const existing = await prisma.outreachAsset.findUnique({
    where: { id },
    select: { senderUserId: true },
  })
  if (!existing || existing.senderUserId !== currentUser.id) {
    return NextResponse.json({ error: 'Template not found or already deleted.' }, { status: 404 })
  }
  await prisma.outreachAsset.delete({ where: { id } })
  return NextResponse.json({ ok: true, id })
}
