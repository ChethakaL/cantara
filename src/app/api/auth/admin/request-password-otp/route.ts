import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendEmailWithComposio } from '@/lib/composio'

export const dynamic = 'force-dynamic'

const OTP_TTL_MS = 10 * 60 * 1000

function generateOtpCode() {
  return String(crypto.randomInt(100000, 999999))
}

function buildOtpKey(email: string) {
  return `admin_password_otp:${email.trim().toLowerCase()}`
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!normalizedEmail) return new Response('Email is required', { status: 400 })

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (!user || user.role !== 'ADMIN') {
      return new Response('Advisor account not found', { status: 404 })
    }

    const code = generateOtpCode()
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString()

    await prisma.appSecret.upsert({
      where: { key: buildOtpKey(normalizedEmail) },
      update: {
        value: JSON.stringify({
          email: normalizedEmail,
          userId: user.id,
          code,
          expiresAt,
        }),
      },
      create: {
        key: buildOtpKey(normalizedEmail),
        value: JSON.stringify({
          email: normalizedEmail,
          userId: user.id,
          code,
          expiresAt,
        }),
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || new URL(req.url).origin
    await sendEmailWithComposio({
      to: normalizedEmail,
      displayName: user.name,
      subject: 'Your Cantara advisor portal password reset code',
      body: `
        <p>Hi ${user.name},</p>
        <p>Use this one-time code to reset your Cantara advisor portal password:</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:0.2em;">${code}</p>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
        <p><a href="${baseUrl}/admin/settings">Open advisor settings</a></p>
      `,
    })

    return NextResponse.json({ success: true, expiresAt })
  } catch (error) {
    console.error('Request admin password OTP error:', error)
    return new Response(error instanceof Error ? error.message : 'Internal Server Error', { status: 500 })
  }
}
