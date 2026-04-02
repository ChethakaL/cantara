import { NextResponse } from 'next/server'
import {
  deactivateNylasConnection,
  fetchGrantDetails,
  getActiveNylasConnection,
  isGrantNotFoundError,
  isNylasConfigured,
} from '@/lib/nylas'

export const dynamic = 'force-dynamic'

export async function GET() {
  let connection = await getActiveNylasConnection()

  if (connection) {
    try {
      await fetchGrantDetails(connection.grantId)
    } catch (error) {
      if (isGrantNotFoundError(error)) {
        await deactivateNylasConnection(connection.grantId)
        connection = null
      } else {
        throw error
      }
    }
  }

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
