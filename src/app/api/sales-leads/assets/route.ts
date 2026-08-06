import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [assets, users] = await Promise.all([
    prisma.outreachAsset.findMany({ include: { senderUser: { select: { id: true, name: true, email: true } }, }, orderBy: [{ assetType: 'asc' }, { touch: 'asc' }, { contactType: 'asc' }, { version: 'desc' }] }),
    prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } }),
  ])
  const email = (await import('next/headers')).cookies().get('cantara_admin_email')?.value
  const currentUserId = email ? (users.find(user => user.email === email)?.id || null) : null
  return NextResponse.json({ assets, users, currentUserId })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const data = {
    senderUserId: body.senderUserId || null,
    touch: Number(body.touch) === 2 ? 2 : 1,
    contactType: body.contactType === 'DIRECT' ? 'DIRECT' as const : 'GENERAL' as const,
    assetType: body.assetType === 'CALL' ? 'CALL' as const : 'EMAIL' as const,
    subject: body.subject ? String(body.subject) : null,
    body: String(body.body || ''),
    version: Number(body.version) || 1,
    active: body.active !== false,
  }
  if (!data.body.trim()) return NextResponse.json({ error: 'Asset body is required.' }, { status: 400 })
  const asset = body.id
    ? await prisma.outreachAsset.update({ where: { id: String(body.id) }, data })
    : await prisma.outreachAsset.create({ data })
  return NextResponse.json({ asset })
}
