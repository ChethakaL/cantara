import { NextRequest, NextResponse } from 'next/server'
import { getProjectEnv } from '@/lib/project-env'
import { processSalesLeadDueDates } from '@/lib/sales-leads/service'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret = getProjectEnv('CRON_SECRET')
  if (secret) {
    const authorization = req.headers.get('authorization')
    if (authorization !== `Bearer ${secret}` && req.headers.get('x-cron-secret') !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  try {
    return NextResponse.json({ ok: true, ...(await processSalesLeadDueDates()) })
  } catch (error) {
    console.error('[cron/sales-leads]', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Sales lead scheduler failed.' },
      { status: 500 },
    )
  }
}
