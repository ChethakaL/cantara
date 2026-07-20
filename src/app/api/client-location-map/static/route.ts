import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  const client = await prisma.clientProfile.findUnique({
    where: { id: clientId },
    select: { sectionSubmissions: true },
  })
  if (!client) return new Response('Client not found', { status: 404 })

  const submissions = (client.sectionSubmissions && typeof client.sectionSubmissions === 'object'
    ? client.sectionSubmissions
    : {}) as Record<string, any>
  const mapData = submissions.clientLocationMap
  const apiKey = process.env.GOOGLE_SERVICES_API

  if (!mapData?.facilityLat || !mapData?.facilityLng || !apiKey) {
    return new Response('Map data is unavailable', { status: 404 })
  }

  const params = new URLSearchParams({
    center: `${mapData.facilityLat},${mapData.facilityLng}`,
    zoom: '10',
    size: '640x640',
    scale: '2',
    maptype: 'roadmap',
    key: apiKey,
  })
  params.append('markers', `color:black|${mapData.facilityLat},${mapData.facilityLng}`)

  for (const clientPin of Array.isArray(mapData.clients) ? mapData.clients : []) {
    if (clientPin.geocodeStatus !== 'success' || clientPin.lat == null || clientPin.lng == null) continue
    const color = clientPin.serviceType === 'boarding' ? 'blue'
      : clientPin.serviceType === 'daycare' ? 'green'
      : clientPin.serviceType === 'grooming' ? 'orange'
      : clientPin.serviceType === 'both' ? 'purple' : 'gray'
    params.append('markers', `color:${color}|${clientPin.lat},${clientPin.lng}`)
  }

  const response = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`, {
    cache: 'no-store',
  })
  if (!response.ok) return new Response('Map image could not be generated', { status: 502 })

  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      'Content-Type': response.headers.get('content-type') || 'image/png',
      'Cache-Control': 'no-store',
    },
  })
}
