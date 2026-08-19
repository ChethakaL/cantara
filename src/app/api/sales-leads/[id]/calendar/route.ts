import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLoggedInAdvisor } from '@/lib/advisor-mail'
import { findLeadCalendarEvents } from '@/lib/sales-leads/calendar-events'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const advisor = await getLoggedInAdvisor()
  if (!advisor) return new Response('Advisor authentication required', { status: 401 })
  const lead = await prisma.salesLead.findUnique({ where: { id: params.id } })
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  try {
    const result = await findLeadCalendarEvents(advisor.id, lead)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[sales-leads/calendar]', error)
    return NextResponse.json(
      { connected: false, events: [], error: error instanceof Error ? error.message : 'Calendar lookup failed' },
      { status: 200 },
    )
  }
}
