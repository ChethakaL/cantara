import { NextRequest, NextResponse } from 'next/server'
import {
  getAdminMessageNotificationPreferences,
  saveAdminMessageNotificationPreferences,
} from '@/lib/admin-message-notification-preferences'

export async function GET() {
  const preferences = await getAdminMessageNotificationPreferences()
  return NextResponse.json({ preferences })
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const preferences = await saveAdminMessageNotificationPreferences({
      emailCantaraEnabled: typeof body.emailCantaraEnabled === 'boolean' ? body.emailCantaraEnabled : undefined,
      cantaraNotificationEmail:
        typeof body.cantaraNotificationEmail === 'string' ? body.cantaraNotificationEmail : undefined,
    })
    return NextResponse.json({ preferences })
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Failed to save preferences', { status: 400 })
  }
}
