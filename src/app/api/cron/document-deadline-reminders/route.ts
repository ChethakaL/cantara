import { NextRequest, NextResponse } from 'next/server'
import { getProjectEnv } from '@/lib/project-env'
import { triggerDailyDocumentDeadlineReminders } from '@/lib/document-deadline-reminder-scheduler'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Optional external ping (e.g. uptime monitor) — same scheduler as daily auto-check. */
export async function GET(req: NextRequest) {
  const secret = getProjectEnv('CRON_SECRET')
  if (secret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${secret}` && req.headers.get('x-cron-secret') !== secret) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  try {
    const result = await triggerDailyDocumentDeadlineReminders({ force: true })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[cron/document-deadline-reminders]', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Reminder job failed' },
      { status: 500 },
    )
  }
}
