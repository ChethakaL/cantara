import { NextRequest, NextResponse } from 'next/server'
import { getLoggedInAdvisor } from '@/lib/advisor-mail'
import {
  disconnectAdvisorGoogleServices,
  getAdvisorGoogleServicesStatus,
  startAdvisorGoogleConnectChain,
} from '@/lib/advisor-google'
import { publicAppOrigin } from '@/lib/public-origin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const advisor = await getLoggedInAdvisor()
  if (!advisor) return new Response('Advisor authentication required', { status: 401 })
  const status = await getAdvisorGoogleServicesStatus(advisor.id)
  return NextResponse.json({
    ...status,
    connected: status.gmail && status.calendar && status.drive,
  })
}

export async function POST(req: NextRequest) {
  const advisor = await getLoggedInAdvisor()
  if (!advisor) return new Response('Advisor authentication required', { status: 401 })
  try {
    const origin = publicAppOrigin(req)
    const link = await startAdvisorGoogleConnectChain(advisor.id, origin)
    return NextResponse.json(link)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start Google connection' },
      { status: 500 },
    )
  }
}

export async function DELETE() {
  const advisor = await getLoggedInAdvisor()
  if (!advisor) return new Response('Advisor authentication required', { status: 401 })
  try {
    await disconnectAdvisorGoogleServices(advisor.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect Google services' },
      { status: 500 },
    )
  }
}
