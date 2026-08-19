import { NextRequest, NextResponse } from 'next/server'
import { getLoggedInAdvisor } from '@/lib/advisor-mail'
import { continueAdvisorGoogleConnectChain } from '@/lib/advisor-google'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin
  const advisor = await getLoggedInAdvisor()
  if (!advisor) {
    return NextResponse.redirect(`${origin}/login/admin?next=/admin`)
  }
  const params = req.nextUrl.searchParams
  if (params.get('status') === 'failed') {
    return NextResponse.redirect(`${origin}/admin?google=error`)
  }
  const next = params.get('next')
  if (next !== 'calendar' && next !== 'drive') {
    return NextResponse.redirect(`${origin}/admin?google=connected`)
  }
  const connectedAccountId = params.get('connected_account_id') || params.get('connectedAccountId')
  try {
    const link = await continueAdvisorGoogleConnectChain(advisor.id, origin, next, connectedAccountId)
    return NextResponse.redirect(link.redirect_url)
  } catch (error) {
    console.error('[google-services/continue]', error)
    return NextResponse.redirect(`${origin}/admin?google=error`)
  }
}
