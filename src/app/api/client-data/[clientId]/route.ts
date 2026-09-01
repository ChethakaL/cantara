import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildDigitalPresenceFormData, syncStructuredToFormResponses } from '@/lib/sync-form-responses'

export async function GET(req: NextRequest, { params }: { params: { clientId: string } }) {
  const { clientId } = params
  const section = req.nextUrl.searchParams.get('section')
  if (!clientId || !section) return new Response('clientId and section required', { status: 400 })

  const client = await (prisma as any).clientProfile.findUnique({
    where: { id: clientId },
    select: {
      businessName: true,
      websiteUrl: true,
      sectionSubmissions: true,
    },
  })

  const data = (client?.sectionSubmissions as Record<string, any>) ?? {}
  if (section === 'digitalPresenceForm') {
    return NextResponse.json(buildDigitalPresenceFormData(data, client))
  }
  return NextResponse.json(data[section] ?? null)
}

export async function PUT(req: NextRequest, { params }: { params: { clientId: string } }) {
  const { clientId } = params
  const { section, data } = await req.json()
  if (!clientId || !section) return new Response('clientId and section required', { status: 400 })

  const client = await (prisma as any).clientProfile.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      businessName: true,
      websiteUrl: true,
      businessAddress: true,
      businessCategory: true,
      sectionSubmissions: true,
    },
  })
  if (!client) return new Response('Not Found', { status: 404 })

  const existing = (client.sectionSubmissions as Record<string, any>) ?? {}
  existing[section] = data

  // Re-sync structured sections to agentFormResponses
  const agentFormResponses = syncStructuredToFormResponses(existing, client)
  existing.agentFormResponses = agentFormResponses

  // Pull fields to sync with ClientProfile root fields if present
  let websiteUrl = client.websiteUrl || undefined
  if (section === 'digitalPresenceForm' && data?.websiteUrl) {
    websiteUrl = data.websiteUrl
  } else if (section === 'competitorPricingInputs' && data?.sellerWebsiteUrl) {
    websiteUrl = data.sellerWebsiteUrl
  } else if (agentFormResponses.businessWebsite) {
    websiteUrl = agentFormResponses.businessWebsite
  }

  let businessAddress = client.businessAddress || undefined
  if (section === 'facilityReviewInputs' && data?.location) {
    businessAddress = data.location
  } else if (agentFormResponses.businessAddress) {
    businessAddress = agentFormResponses.businessAddress
  }

  let businessCategory = client.businessCategory || undefined
  if (agentFormResponses.businessCategory) {
    businessCategory = agentFormResponses.businessCategory
  }

  await (prisma as any).clientProfile.update({
    where: { id: clientId },
    data: {
      sectionSubmissions: existing,
      websiteUrl,
      businessAddress,
      businessCategory,
    },
  })

  return NextResponse.json({ ok: true })
}
