import { NextRequest, NextResponse } from 'next/server'
import { deactivateNylasConnection, getActiveNylasConnection, isGrantNotFoundError, nylasFetch } from '@/lib/nylas'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const connection = await getActiveNylasConnection()
  if (!connection) {
    return NextResponse.json({ items: [], error: 'Nylas is not connected.' }, { status: 200 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const horizonDays = Math.min(Math.max(Number(searchParams.get('horizonDays') || '45'), 1), 120)
    const now = new Date()
    const horizon = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000)
    const calendarId = connection.calendarIds[0] || 'primary'

    const params = new URLSearchParams({
      calendar_id: calendarId,
      start: String(Math.floor(now.getTime() / 1000)),
      end: String(Math.floor(horizon.getTime() / 1000)),
      limit: '100',
    })

    const data = await nylasFetch<{ data?: unknown[] }>(`/v3/grants/${connection.grantId}/events?${params.toString()}`)
    return NextResponse.json({ items: data.data || [] })
  } catch (error) {
    console.error('NYLAS_CALENDAR_EVENTS_ERROR', error)

    if (connection && isGrantNotFoundError(error)) {
      await deactivateNylasConnection(connection.grantId)
      return NextResponse.json(
        { items: [], error: 'Saved calendar connection is no longer valid. Please reconnect the calendar.' },
        { status: 200 }
      )
    }

    return NextResponse.json(
      { items: [], error: error instanceof Error ? error.message : 'Could not load calendar events.' },
      { status: 400 }
    )
  }
}
