import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { mapChatMessage } from '@/lib/chat-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const unreadRows = await prisma.chatMessage.groupBy({
      by: ['clientId'],
      where: { senderRole: 'CLIENT', readByAdmin: false },
      _count: { _all: true },
      _max: { timestamp: true },
      orderBy: { _max: { timestamp: 'desc' } },
    })

    if (!unreadRows.length) {
      return NextResponse.json({ threads: [] })
    }

    const clientIds = unreadRows.map(row => row.clientId)
    const clients = await prisma.clientProfile.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, businessName: true, email: true, User: { select: { name: true } } },
    })
    const clientById = new Map(clients.map(client => [client.id, client]))

    const threads = await Promise.all(unreadRows.map(async (row) => {
      const messages = await prisma.chatMessage.findMany({
        where: { clientId: row.clientId },
        orderBy: { timestamp: 'asc' },
        take: 20,
      })

      const client = clientById.get(row.clientId)
      return {
        clientId: row.clientId,
        clientName: client?.User?.name || client?.businessName || client?.email || 'Client',
        businessName: client?.businessName || client?.User?.name || client?.email || 'Client',
        unreadCount: row._count._all,
        lastMessageAt: row._max.timestamp?.toISOString() ?? null,
        messages: messages.map(mapChatMessage),
      }
    }))

    return NextResponse.json({ threads })
  } catch (error) {
    console.error('GET admin chat inbox error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
