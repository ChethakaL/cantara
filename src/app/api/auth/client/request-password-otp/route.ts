import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmailWithComposio } from '@/lib/composio'

export const dynamic = 'force-dynamic'

const OTP_TTL_MS = 10 * 60 * 1000

function generateOtpCode() {
  return String(crypto.randomInt(100000, 999999))
}

async function resolveClientIdForUserEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true, ClientProfile: { select: { id: true } } },
  })
  if (user?.ClientProfile?.id) return user.ClientProfile.id

  const teamMember = await prisma.teamMember.findFirst({
    where: { email: normalized },
    select: { clientId: true },
  })
  return teamMember?.clientId ?? null
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail) return new Response('Email is required', { status: 400 })

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (!user || user.role !== 'CLIENT') {
      return new Response('Account not found', { status: 404 })
    }

    const clientId = await resolveClientIdForUserEmail(normalizedEmail)
    if (!clientId) return new Response('Client workspace not found', { status: 404 })

    const code = generateOtpCode()
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString()

    const client = await prisma.clientProfile.findUnique({
      where: { id: clientId },
      select: { sectionSubmissions: true, businessName: true },
    })
    if (!client) return new Response('Client not found', { status: 404 })

    const current = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
      ? client.sectionSubmissions
      : {}) as Record<string, unknown>

    await prisma.clientProfile.update({
      where: { id: clientId },
      data: {
        sectionSubmissions: {
          ...current,
          passwordOtp: {
            email: normalizedEmail,
            userId: user.id,
            code,
            expiresAt,
          },
        } as any,
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || new URL(req.url).origin
    await sendEmailWithComposio({
      to: normalizedEmail,
      displayName: user.name,
      subject: 'Your Cantara portal password reset code',
      body: `
        <p>Hi ${user.name},</p>
        <p>Use this one-time code to reset your Cantara client portal password:</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:0.2em;">${code}</p>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
        <p><a href="${baseUrl}/dashboard/settings">Open account settings</a></p>
      `,
    })

    return NextResponse.json({ success: true, expiresAt })
  } catch (error) {
    console.error('Request password OTP error:', error)
    return new Response(error instanceof Error ? error.message : 'Internal Server Error', { status: 500 })
  }
}
