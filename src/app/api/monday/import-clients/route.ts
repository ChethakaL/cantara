import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { prisma } from '@/lib/prisma'

function generatePassword() {
  return crypto.randomBytes(9).toString('base64url')
}

function buildDisplayName(client: {
  firstName?: string
  lastName?: string
  name?: string
  company?: string
}) {
  const fromParts = [client.firstName?.trim(), client.lastName?.trim()].filter(Boolean).join(' ').trim()
  if (fromParts) return fromParts
  if (client.name?.trim()) return client.name.trim()
  if (client.company?.trim()) return client.company.trim()
  return ''
}

export async function POST(req: NextRequest) {
  try {
    const { clients } = await req.json() as {
      clients: Array<{
        firstName?: string
        lastName?: string
        name?: string
        email: string
        phone?: string
        company?: string
        website?: string
        mondayItemId?: string
        businessCategory?: string
        propertyOwnership?: string
        businessAddress?: string
      }>
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
      const displayName = buildDisplayName(client)
      if (!email || !displayName) {
        results.push({
          name: displayName || 'Unknown',
          email: email || '',
          status: 'skipped',
          reason: 'Missing name or email',
        })
        continue
      }

      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        const existingProfile = await prisma.clientProfile.findFirst({ where: { userId: existing.id } })
        results.push({
          name: displayName,
          email,
          status: 'skipped',
          reason: existingProfile ? 'Client already exists in the system' : 'User email already registered',
          clientId: existingProfile?.id,
        })
        continue
      }

      const plainPassword = generatePassword()
      const businessName = client.company?.trim() || displayName

      const user = await prisma.user.create({
        data: {
          email,
          name: displayName,
          passwordHash: plainPassword,
          mustChangePassword: true,
          role: 'CLIENT',
        },
      })

      // Normalize property ownership value
      const rawOwnership = client.propertyOwnership?.trim().toLowerCase() ?? ''
      const propertyOwnership = rawOwnership.includes('own') ? 'owns' : rawOwnership.includes('lease') ? 'lease' : ''

      const profile = await prisma.clientProfile.create({
        data: {
          userId: user.id,
          businessName,
          email,
          phone: client.phone?.trim() || null,
          websiteUrl: client.website?.trim() || null,
          businessAddress: client.businessAddress?.trim() || null,
          businessCategory: client.businessCategory?.trim() || null,
          stage: 'ONBOARDING',
          businessType: 'SINGLE',
          notes: client.mondayItemId ? `Imported from Monday item ${client.mondayItemId}` : undefined,
          ...(propertyOwnership ? { sectionSubmissions: { propertyOwnership } } : {}),
        },
      })

      results.push({
        name: displayName,
        email,
        status: 'created',
        password: plainPassword,
        clientId: profile.id,
      })
    }

    return NextResponse.json({ results })
  } catch (error: unknown) {
    console.error('Monday import clients error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(`Failed to import clients: ${message}`, { status: 500 })
  }
}
