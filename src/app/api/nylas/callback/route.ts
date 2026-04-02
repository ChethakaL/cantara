import { NextRequest, NextResponse } from 'next/server'
import {
  exchangeNylasCodeForGrant,
  fetchGrantCalendars,
  fetchGrantDetails,
  upsertActiveNylasConnection,
} from '@/lib/nylas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const rawState = searchParams.get('state')

  let returnTo = '/admin'

  if (rawState) {
    try {
      const parsed = JSON.parse(Buffer.from(rawState, 'base64url').toString('utf8')) as { returnTo?: string }
      if (parsed.returnTo) returnTo = parsed.returnTo
    } catch {}
  }

  if (error || !code) {
    return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}nylas=error`, req.url))
  }

  try {
    const token = await exchangeNylasCodeForGrant(code)
    const grantId = token.grant_id
    if (!grantId) throw new Error('Nylas did not return a grant id.')

    const [grantDetails, calendars] = await Promise.all([fetchGrantDetails(grantId), fetchGrantCalendars(grantId)])
    const calendarIds = (calendars.data || [])
      .filter((calendar) => calendar.id && !calendar.read_only)
      .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)))
      .map((calendar) => calendar.id as string)

    await upsertActiveNylasConnection({
      grantId,
      email: grantDetails.data?.email || token.email || null,
      provider: grantDetails.data?.provider || token.provider || null,
      calendarIds,
    })

    return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}nylas=connected`, req.url))
  } catch (callbackError) {
    console.error('NYLAS_CALLBACK_ERROR', callbackError)
    return NextResponse.redirect(new URL(`${returnTo}${returnTo.includes('?') ? '&' : '?'}nylas=error`, req.url))
  }
}
