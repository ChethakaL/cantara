import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST() {
  await (prisma as any).nylasConnection.updateMany({
    where: { active: true },
    data: { active: false },
  })

  return NextResponse.json({ ok: true })
}
