import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const MAX_MARKERS = 80

function buildCirclePath(center: { lat: number; lng: number }, radiusMiles: number) {
  const points: string[] = []
  const earthRadiusMiles = 3958.8
  const angularDistance = radiusMiles / earthRadiusMiles
  const lat1 = (center.lat * Math.PI) / 180
  const lng1 = (center.lng * Math.PI) / 180

  for (let step = 0; step <= 24; step++) {
    const bearing = (2 * Math.PI * step) / 24
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
    )
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    )
    points.push(`${(lat2 * 180) / Math.PI},${(lng2 * 180) / Math.PI}`)
  }

  return points.join('|')
}

function markerColor(serviceType: string) {
  if (serviceType === 'boarding') return 'blue'
  if (serviceType === 'daycare') return 'green'
  if (serviceType === 'grooming') return 'orange'
  if (serviceType === 'both') return 'purple'
  return 'gray'
}

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

  const facility = { lat: Number(mapData.facilityLat), lng: Number(mapData.facilityLng) }
  const geocoded = (Array.isArray(mapData.clients) ? mapData.clients : [])
    .filter((pin: { geocodeStatus?: string; lat?: number; lng?: number }) =>
      pin.geocodeStatus === 'success' && pin.lat != null && pin.lng != null,
    )

  const seen = new Set<string>()
  const uniquePins = geocoded.filter((pin: { lat: number; lng: number }) => {
    const key = `${pin.lat},${pin.lng}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const markerPins = uniquePins.slice(0, MAX_MARKERS)
  const truncated = uniquePins.length > MAX_MARKERS

  const params = new URLSearchParams({
    center: `${facility.lat},${facility.lng}`,
    zoom: '10',
    size: '1200x720',
    scale: '2',
    maptype: 'roadmap',
    key: apiKey,
  })

  params.append('path', `color:0x16a34a55|weight:2|fillcolor:0x16a34a11|${buildCirclePath(facility, 5)}`)
  params.append('path', `color:0xeab30855|weight:2|fillcolor:0xeab30811|${buildCirclePath(facility, 10)}`)
  params.append('path', `color:0xdc262655|weight:2|fillcolor:0xdc262611|${buildCirclePath(facility, 20)}`)
  params.append('markers', `color:black|${facility.lat},${facility.lng}`)

  for (const clientPin of markerPins) {
    params.append('markers', `color:${markerColor(clientPin.serviceType)}|${clientPin.lat},${clientPin.lng}`)
  }

  const response = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`, {
    cache: 'no-store',
  })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error('[client-location-map/static] Google Static Maps failed', {
      clientId,
      status: response.status,
      markerCount: markerPins.length,
      detail: detail.slice(0, 300),
    })
    return new Response('Map image could not be generated', { status: 502 })
  }

  const headers: Record<string, string> = {
    'Content-Type': response.headers.get('content-type') || 'image/png',
    'Cache-Control': 'no-store',
    'X-Map-Markers-Total': String(uniquePins.length),
    'X-Map-Markers-Shown': String(markerPins.length),
  }
  if (truncated) headers['X-Map-Markers-Truncated'] = 'true'

  return new NextResponse(await response.arrayBuffer(), { headers })
}
