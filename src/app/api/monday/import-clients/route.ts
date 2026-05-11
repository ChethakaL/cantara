import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function generatePassword() {
  // 12-char password: uppercase + lowercase + digit + symbol
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const symbols = '!@#$%&'
  const all = upper + lower + digits + symbols
  let pwd = ''
  pwd += upper[Math.floor(Math.random() * upper.length)]
  pwd += lower[Math.floor(Math.random() * lower.length)]
  pwd += digits[Math.floor(Math.random() * digits.length)]
  pwd += symbols[Math.floor(Math.random() * symbols.length)]
  for (let i = 4; i < 12; i++) {
    pwd += all[Math.floor(Math.random() * all.length)]
  }
  return pwd.split('').sort(() => Math.random() - 0.5).join('')
}

export async function POST(req: NextRequest) {
  try {
    const { clients } = await req.json() as {
      clients: Array<{ name: string; email: string; company?: string; mondayItemId?: string }>
    }

    if (!Array.isArray(clients) || clients.length === 0) {
      return new Response('clients array is required', { status: 400 })
    }

    const results: Array<{
      name: string
      email: string
      status: 'created' | 'skipped'
      reason?: string
      password?: string
      clientId?: string
    }> = []

    for (const client of clients) {
      const email = client.email?.trim().toLowerCase()
      const name = client.name?.trim()
      if (!email || !name) {
        results.push({ name: name || 'Unknown', email: email || '', status: 'skipped', reason: 'Missing name or email' })
        continue
      }

      // Check if already exists
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        // Check if they already have a client profile
        const existingProfile = await prisma.clientProfile.findFirst({ where: { userId: existing.id } })
        results.push({
          name,
          email,
          status: 'skipped',
          reason: existingProfile ? 'Client already exists in the system' : 'User email already registered',
          clientId: existingProfile?.id,
        })
        continue
      }

      // Generate a plain-text password (stored same way as manual client creation)
      const plainPassword = generatePassword()

      const user = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash: plainPassword,
          role: 'CLIENT',
        },
      })

      const profile = await prisma.clientProfile.create({
        data: {
          userId: user.id,
          businessName: client.company || name,
          email: email,
          stage: 'ONBOARDING',
          businessType: 'SINGLE',
        },
      })

      results.push({
        name,
        email,
        status: 'created',
        password: plainPassword,
        clientId: profile.id,
      })
    }

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error('Monday import clients error:', error)
    return new Response(`Failed to import clients: ${error.message}`, { status: 500 })
  }
}
