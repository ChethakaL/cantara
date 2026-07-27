import { NextRequest, NextResponse } from 'next/server'
import { getProjectEnv } from '@/lib/project-env'
import {
  processSalesLeadHandoffOutbox,
  processSalesLeadSyncOutbox,
} from '@/lib/sales-leads/monday-sync'

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
    const [monday, handoffs] = await Promise.all([
      processSalesLeadSyncOutbox(),
      processSalesLeadHandoffOutbox(),
    ])
    return NextResponse.json({ ok: true, monday, handoffs })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Sync processing failed.' },
      { status: 500 },
    )
  }
}
