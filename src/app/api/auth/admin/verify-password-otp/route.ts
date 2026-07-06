import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function buildOtpKey(email: string) {
  return `admin_password_otp:${email.trim().toLowerCase()}`
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
    if (!user || user.role !== 'ADMIN') {
      return new Response('Advisor account not found', { status: 404 })
    }

    const otpRow = await prisma.appSecret.findUnique({
      where: { key: buildOtpKey(normalizedEmail) },
    })
    if (!otpRow) {
      return new Response('No active verification code. Request a new code.', { status: 400 })
    }

    let otp: { email?: string; userId?: string; code?: string; expiresAt?: string } | null = null
    try {
      otp = JSON.parse(otpRow.value)
    } catch {
      otp = null
    }

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

    await prisma.appSecret.delete({
      where: { key: buildOtpKey(normalizedEmail) },
    }).catch(() => undefined)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Verify admin password OTP error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
