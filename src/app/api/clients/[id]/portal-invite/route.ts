import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLoggedInAdvisor, getAdvisorMailConnection, sendAdvisorEmail } from '@/lib/advisor-mail'
import { recordClientEmailNotification } from '@/lib/client-email-notifications'
import {
  buildClientPortalInviteDraft,
  CLIENT_PORTAL_INVITE_REMINDER_DAYS,
  CLIENT_PORTAL_INVITE_TARGET_DEADLINE,
  CLIENT_PORTAL_INVITE_DOCUMENT_ID,
} from '@/lib/client-portal-invite'

type PortalInviteStatus = 'NOT_SENT' | 'SENT' | 'FAILED'

async function loadClientForInvite(clientId: string) {
  return prisma.clientProfile.findUnique({
    where: { id: clientId },
    include: { User: true },
  })
}

async function getLatestPortalInviteNotification(clientId: string, recipientEmail: string) {
  return (prisma as any).clientEmailNotification.findFirst({
    where: {
      clientId,
      type: 'CLIENT_PORTAL_INVITE',
      recipientEmail: recipientEmail.toLowerCase(),
      reminderDaysBefore: CLIENT_PORTAL_INVITE_REMINDER_DAYS,
      documentId: CLIENT_PORTAL_INVITE_DOCUMENT_ID,
      targetDeadline: CLIENT_PORTAL_INVITE_TARGET_DEADLINE,
    },
    orderBy: { sentAt: 'desc' },
  })
}

function resolveAppBaseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || new URL(req.url).origin
}

async function buildInvitePayload(clientId: string, req: NextRequest) {
  const client = await loadClientForInvite(clientId)
  if (!client) return null

  const contactName = client.User?.name?.trim() || client.businessName
  const email = (client.email || client.User?.email || '').trim().toLowerCase()
  const businessName = client.businessName?.trim() || contactName
  const password = client.User?.passwordHash?.trim() || ''

  if (!email) {
    return { error: 'Client has no email address', status: 400 as const }
  }
  if (!password) {
    return { error: 'Client login password is unavailable', status: 400 as const }
  }

  const baseUrl = resolveAppBaseUrl(req)
  const loginUrl = `${baseUrl}/login/client`
  const settingsUrl = `${baseUrl}/dashboard/settings`
  const advisorName = process.env.CANTARA_ADVISOR_NAME || 'Cantara Pet Advisors'

  const draft = buildClientPortalInviteDraft({
    businessName,
    contactName,
    email,
    password,
    loginUrl,
    settingsUrl,
    businessCategory: client.businessCategory || undefined,
    advisorName,
  })

  const advisor = await getLoggedInAdvisor()
  const mailConnection = advisor ? await getAdvisorMailConnection(advisor.id).catch(() => null) : null
  const notification = await getLatestPortalInviteNotification(clientId, email)

  let status: PortalInviteStatus = 'NOT_SENT'
  if (notification?.status === 'SENT') status = 'SENT'
  else if (notification?.status === 'FAILED') status = 'FAILED'

  return {
    clientId,
    recipientEmail: email,
    recipientName: contactName,
    businessName,
    password,
    loginUrl,
    fromEmail: mailConnection?.connectedEmail || '',
    subject: notification?.subject || draft.subject,
    bodyHtml: notification?.payload?.bodyHtml || draft.bodyHtml,
    defaultSubject: draft.subject,
    defaultBodyHtml: draft.bodyHtml,
    status,
    lastSentAt: notification?.sentAt?.toISOString() ?? null,
    errorMessage: notification?.errorMessage ?? null,
    mailConfigured: Boolean(mailConnection?.active),
    connectedSenderEmail: mailConnection?.connectedEmail ?? null,
    advisorId: advisor?.id ?? null,
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const payload = await buildInvitePayload(params.id, _req)
    if (!payload) return new Response('Not Found', { status: 404 })
    if ('error' in payload) return new Response(payload.error, { status: Number(payload.status) })
    return NextResponse.json(payload)
  } catch (error) {
    console.error('GET portal invite error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}))
    const subject = String(body.subject || '').trim()
    const bodyHtml = String(body.bodyHtml || '').trim()

    if (!subject || !bodyHtml) {
      return new Response('Subject and email body are required', { status: 400 })
    }

    const payload = await buildInvitePayload(params.id, req)
    if (!payload) return new Response('Not Found', { status: 404 })
    if ('error' in payload) return new Response(payload.error, { status: Number(payload.status) })

    if (!payload.mailConfigured || !payload.advisorId) {
      return new Response('Gmail is not configured for your advisor account. Connect your Gmail in Advisor Settings first.', {
        status: 503,
      })
    }

    try {
      await sendAdvisorEmail({
        userId: payload.advisorId,
        to: payload.recipientEmail,
        displayName: payload.recipientName,
        subject,
        body: bodyHtml,
      })

      await recordClientEmailNotification({
        clientId: params.id,
        type: 'CLIENT_PORTAL_INVITE',
        recipientEmail: payload.recipientEmail,
        subject,
        reminderDaysBefore: CLIENT_PORTAL_INVITE_REMINDER_DAYS,
        documentId: CLIENT_PORTAL_INVITE_DOCUMENT_ID,
        targetDeadline: CLIENT_PORTAL_INVITE_TARGET_DEADLINE,
        payload: { bodyHtml },
        status: 'SENT',
        errorMessage: null,
      })

      return NextResponse.json({
        ok: true,
        status: 'SENT' satisfies PortalInviteStatus,
        sentAt: new Date().toISOString(),
      })
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : 'Failed to send email'

      await recordClientEmailNotification({
        clientId: params.id,
        type: 'CLIENT_PORTAL_INVITE',
        recipientEmail: payload.recipientEmail,
        subject,
        reminderDaysBefore: CLIENT_PORTAL_INVITE_REMINDER_DAYS,
        documentId: CLIENT_PORTAL_INVITE_DOCUMENT_ID,
        targetDeadline: CLIENT_PORTAL_INVITE_TARGET_DEADLINE,
        payload: { bodyHtml },
        status: 'FAILED',
        errorMessage: message,
      })

      return NextResponse.json(
        {
          ok: false,
          status: 'FAILED' satisfies PortalInviteStatus,
          errorMessage: message,
        },
        { status: 502 },
      )
    }
  } catch (error) {
    console.error('POST portal invite error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
