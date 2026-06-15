import { prisma } from '@/lib/prisma'

export type PortalNotificationItem = {
  id: string
  type: 'message' | 'deadline' | 'action_item' | 'email'
  title: string
  body: string
  timestamp: string
  unread: boolean
  href?: string
}

export async function buildClientPortalNotificationFeed(clientId: string): Promise<PortalNotificationItem[]> {
  const items: PortalNotificationItem[] = []

  const [chatMessages, emailRows, requirements] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { clientId, senderRole: 'ADMIN' },
      orderBy: { timestamp: 'desc' },
      take: 30,
    }),
    prisma.clientEmailNotification.findMany({
      where: { clientId, status: 'SENT' },
      orderBy: { sentAt: 'desc' },
      take: 30,
    }),
    prisma.additionalRequirement.findMany({
      where: { clientId, status: 'OPEN' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ])

  for (const message of chatMessages) {
    items.push({
      id: `chat-${message.id}`,
      type: 'message',
      title: 'Message from your Cantara team',
      body: message.message,
      timestamp: message.timestamp.toISOString(),
      unread: !message.readByClient,
      href: '/dashboard',
    })
  }

  for (const row of emailRows) {
    const rowType = String(row.type)
    const typeLabel =
      rowType === 'DOCUMENT_DEADLINE_REMINDER'
        ? 'Document deadline reminder'
        : rowType === 'CHAT_MESSAGE'
          ? 'New portal message'
          : rowType === 'TEAM_MEMBER_INVITE'
            ? 'Team invitation sent'
            : 'Portal update'
    items.push({
      id: `email-${row.id}`,
      type: rowType === 'DOCUMENT_DEADLINE_REMINDER' ? 'deadline' : 'email',
      title: typeLabel,
      body: row.subject,
      timestamp: row.sentAt.toISOString(),
      unread: false,
    })
  }

  for (const req of requirements) {
    items.push({
      id: `req-${req.id}`,
      type: 'action_item',
      title: req.title,
      body: req.description || req.question || 'Action required in your portal.',
      timestamp: req.createdAt.toISOString(),
      unread: true,
      href: '/dashboard',
    })
  }

  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}
