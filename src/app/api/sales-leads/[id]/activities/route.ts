import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const activities = await prisma.salesLeadActivity.findMany({
    where: { leadId: id },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ activities })
}
