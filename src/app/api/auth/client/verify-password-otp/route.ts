import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function resolveClientIdForUserEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    select: { ClientProfile: { select: { id: true } } },
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
    const { email, code, newPassword } = await req.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const otpCode = String(code || '').trim()
    const password = String(newPassword || '')

    if (!normalizedEmail || !otpCode || !password) {
      return new Response('Email, verification code, and new password are required', { status: 400 })
    }
    if (password.length < 8) {
      return new Response('New password must be at least 8 characters', { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (!user || user.role !== 'CLIENT') {
      return new Response('Account not found', { status: 404 })
    }

    const clientId = await resolveClientIdForUserEmail(normalizedEmail)
    if (!clientId) return new Response('Client workspace not found', { status: 404 })

    const client = await prisma.clientProfile.findUnique({
      where: { id: clientId },
      select: { sectionSubmissions: true },
    })
    if (!client) return new Response('Client not found', { status: 404 })

    const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
      ? client.sectionSubmissions
      : {}) as Record<string, any>
    const otp = submissions.passwordOtp

    if (!otp || otp.email !== normalizedEmail || otp.userId !== user.id) {
      return new Response('No active verification code. Request a new code.', { status: 400 })
    }
    if (String(otp.code) !== otpCode) {
      return new Response('Invalid verification code', { status: 401 })
    }
    if (!otp.expiresAt || new Date(otp.expiresAt).getTime() < Date.now()) {
      return new Response('Verification code expired. Request a new code.', { status: 410 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: password,
        mustChangePassword: false,
      },
    })

    const { passwordOtp: _removed, ...rest } = submissions
    await prisma.clientProfile.update({
      where: { id: clientId },
      data: { sectionSubmissions: rest as any },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Verify password OTP error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
