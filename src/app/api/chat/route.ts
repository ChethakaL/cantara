import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { publishChatUpdate } from '@/lib/chat-bus'
import { mapChatMessage, normalizeSenderRole } from '@/lib/chat-utils'
import { sendClientPortalNotificationEmail } from '@/lib/client-portal-notification-email'
import {
  getAdminMessageNotificationPreferences,
  resolveCantaraNotificationEmail,
} from '@/lib/admin-message-notification-preferences'
import { sendEmailWithComposio } from '@/lib/composio'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return NextResponse.json({ messages: [] })

  try {
    const messages = await prisma.chatMessage.findMany({
      where: { clientId },
      orderBy: { timestamp: 'asc' },
    })

    return NextResponse.json({
      messages: messages.map(mapChatMessage),
    })
  } catch (error) {
    console.error('GET Chat Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { clientId, senderRole, senderName, message } = await req.json()

    if (!clientId || !message) {
      return new Response('Missing required fields', { status: 400 })
    }

    const role = normalizeSenderRole(String(senderRole || 'client'))
    const msg = await prisma.chatMessage.create({
      data: {
        clientId,
        senderRole: role === 'admin' ? 'ADMIN' : 'CLIENT',
        senderName,
        message,
        readByAdmin: role === 'admin',
        readByClient: role === 'client',
      },
    })

    publishChatUpdate(clientId)

    const adminPrefs = await getAdminMessageNotificationPreferences()

    if (role === 'admin') {
        const client = await prisma.clientProfile.findUnique({
          where: { id: clientId },
          select: { businessName: true },
        })
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''
        const loginUrl = baseUrl ? `${baseUrl}/dashboard/notifications` : '/dashboard/notifications'
        const subject = `New message from Cantara — ${client?.businessName || 'your portal'}`
        const body = `
          <p>Hi,</p>
          <p>Your Cantara advisor team sent you a new message in the client portal:</p>
          <blockquote style="border-left:3px solid #d4a843;padding-left:12px;color:#334155;">${String(message).replace(/\n/g, '<br/>')}</blockquote>
          <p><a href="${loginUrl}">View notifications and reply in the portal</a></p>
          <p>Thank you,<br/>Cantara Pet Advisors</p>
        `

        try {
          await sendClientPortalNotificationEmail({
            clientId,
            type: 'CHAT_MESSAGE',
            subject,
            body,
            documentId: msg.id,
            payload: { messageId: msg.id, preview: String(message).slice(0, 280) },
          })
        } catch (error) {
          console.error('CHAT_MESSAGE_EMAIL_ERROR', { clientId, messageId: msg.id, error })
        }
      }

    if (role === 'client') {
      const cantaraEmail = resolveCantaraNotificationEmail(adminPrefs)
      if (cantaraEmail) {
        const client = await prisma.clientProfile.findUnique({
          where: { id: clientId },
          select: { businessName: true, email: true },
        })
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || ''
        const adminUrl = baseUrl ? `${baseUrl}/admin/client/${clientId}?tab=messages` : `/admin/client/${clientId}?tab=messages`
        const businessLabel = client?.businessName || 'Client portal'
        const senderLabel = senderName || client?.email || 'Client'
        const subject = `New client message — ${businessLabel}`
        const body = `
          <p>Hi Cantara team,</p>
          <p><strong>${senderLabel}</strong> sent a new message in the ${businessLabel} portal:</p>
          <blockquote style="border-left:3px solid #d4a843;padding-left:12px;color:#334155;">${String(message).replace(/\n/g, '<br/>')}</blockquote>
          <p><a href="${adminUrl}">Open Messages in the advisor dashboard</a></p>
        `
        try {
          await sendEmailWithComposio({
            to: cantaraEmail,
            displayName: 'Cantara Portal',
            subject,
            body,
          })
        } catch (error) {
          console.error('CHAT_MESSAGE_ADMIN_EMAIL_ERROR', { clientId, messageId: msg.id, error })
        }
      }
    }

    return NextResponse.json({ success: true, message: mapChatMessage(msg) })
  } catch (error) {
    console.error('POST Chat Error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
