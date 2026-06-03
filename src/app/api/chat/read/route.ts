import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publishChatUpdate } from '@/lib/chat-bus'
import type { ChatViewerRole } from '@/lib/chat-utils'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  try {
    const { clientId, viewer } = await req.json() as { clientId?: string; viewer?: ChatViewerRole }
    if (!clientId || (viewer !== 'admin' && viewer !== 'client')) {
      return new Response('Invalid payload', { status: 400 })
    }

    if (viewer === 'admin') {
      await prisma.chatMessage.updateMany({
        where: { clientId, senderRole: 'CLIENT', readByAdmin: false },
        data: { readByAdmin: true },
      })
    } else {
      await prisma.chatMessage.updateMany({
        where: { clientId, senderRole: 'ADMIN', readByClient: false },
        data: { readByClient: true },
      })
    }

    publishChatUpdate(clientId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('PATCH chat read error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
