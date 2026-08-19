import { NextRequest, NextResponse } from 'next/server'
import { getLoggedInAdvisor, getAdvisorMailConnection, createAdvisorMailConnectLink } from '@/lib/advisor-mail'

export const dynamic = 'force-dynamic'

export async function GET() {
  const advisor = await getLoggedInAdvisor()
  if (!advisor) return new Response('Advisor authentication required', { status: 401 })
  const connection = await getAdvisorMailConnection(advisor.id)
  return NextResponse.json({
    configured: Boolean(connection?.active),
    email: connection?.connectedEmail ?? null,
    status: connection?.status ?? null,
  })
}

export async function POST(req: NextRequest) {
  const advisor = await getLoggedInAdvisor()
  if (!advisor) return new Response('Advisor authentication required', { status: 401 })
  try {
    const origin = new URL(req.url).origin
    const link = await createAdvisorMailConnectLink(advisor.id, `${origin}/admin/settings?advisor-mail=connected`)
    return NextResponse.json(link)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to connect Gmail' }, { status: 500 })
  }
}
