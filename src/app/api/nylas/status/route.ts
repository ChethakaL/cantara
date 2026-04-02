import { NextResponse } from 'next/server'
import { getActiveNylasConnection, isNylasConfigured } from '@/lib/nylas'

export const dynamic = 'force-dynamic'

export async function GET() {
  const connection = await getActiveNylasConnection()
  return NextResponse.json({
    configured: isNylasConfigured(),
    connected: Boolean(connection),
    connection: connection
      ? {
          id: connection.id,
          grantId: connection.grantId,
          email: connection.email,
          provider: connection.provider,
          calendarIds: connection.calendarIds,
        }
      : null,
  })
}
