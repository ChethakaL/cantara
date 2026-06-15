import { NextRequest, NextResponse } from 'next/server'
import { buildClientPortalNotificationFeed } from '@/lib/client-portal-notification-feed'
import {
  getClientNotificationPreferences,
  saveClientNotificationPreferences,
} from '@/lib/client-notification-preferences'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('clientId')
  if (!clientId) return new Response('clientId required', { status: 400 })

  try {
    const [items, preferences] = await Promise.all([
      buildClientPortalNotificationFeed(clientId),
      getClientNotificationPreferences(clientId),
    ])
    return NextResponse.json({ items, preferences })
  } catch (error) {
    console.error('GET client portal notifications error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const clientId = String(body.clientId || '')
    if (!clientId) return new Response('clientId required', { status: 400 })

    const emailEnabled = Boolean(body.emailEnabled)
    const notificationEmail = String(body.notificationEmail || '').trim()

    const saved = await saveClientNotificationPreferences(clientId, {
      emailEnabled,
      notificationEmail,
    })

    return NextResponse.json({ preferences: saved })
  } catch (error) {
    console.error('PATCH client portal notification preferences error:', error)
    return new Response(error instanceof Error ? error.message : 'Internal Server Error', { status: 500 })
  }
}
