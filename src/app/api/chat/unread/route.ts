import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { ChatViewerRole } from '@/lib/chat-utils'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  const viewer = req.nextUrl.searchParams.get('viewer') as ChatViewerRole | null

  if (!viewer || (viewer !== 'admin' && viewer !== 'client')) {
    return new Response('viewer is required (admin|client)', { status: 400 })
  }

  try {
    if (clientId) {
      const count = await prisma.chatMessage.count({
        where: viewer === 'admin'
          ? { clientId, senderRole: 'CLIENT', readByAdmin: false }
          : { clientId, senderRole: 'ADMIN', readByClient: false },
      })
      return NextResponse.json({ clientId, count })
    }

    if (viewer !== 'admin') {
      return new Response('clientId required for client viewer', { status: 400 })
    }

    const rows = await prisma.chatMessage.groupBy({
      by: ['clientId'],
      where: { senderRole: 'CLIENT', readByAdmin: false },
      _count: { _all: true },
    })

    const counts = Object.fromEntries(rows.map(row => [row.clientId, row._count._all]))
    const total = rows.reduce((sum, row) => sum + row._count._all, 0)
    return NextResponse.json({ counts, total })
  } catch (error) {
    console.error('GET chat unread error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
