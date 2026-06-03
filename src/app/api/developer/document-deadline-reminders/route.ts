import { NextRequest, NextResponse } from 'next/server'
import { requireDeveloperSecret } from '@/lib/developer-auth'
import {
  getReminderLastRun,
  getReminderScheduleConfig,
  getZonedCalendarParts,
  shouldRunScheduledReminders,
  triggerDailyDocumentDeadlineReminders,
} from '@/lib/document-deadline-reminder-scheduler'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = requireDeveloperSecret(req.headers.get('x-developer-secret'))
  if (!auth.ok) return new Response(auth.message, { status: auth.status })

  const now = new Date()
  const schedule = getReminderScheduleConfig()
  const zoned = getZonedCalendarParts(now, schedule.timeZone)
  const lastRun = await getReminderLastRun()
  const due = shouldRunScheduledReminders(now, lastRun)

  return NextResponse.json({
    schedule,
    now: now.toISOString(),
    zoned,
    lastRun,
    wouldRunNow: due.run,
    skipReason: due.run ? null : due.reason,
  })
}

export async function POST(req: NextRequest) {
  const auth = requireDeveloperSecret(req.headers.get('x-developer-secret'))
  if (!auth.ok) return new Response(auth.message, { status: auth.status })

  const url = new URL(req.url)
  const force = url.searchParams.get('force') === 'true'
  const dryRun = url.searchParams.get('dryRun') === 'true'

  try {
    const result = await triggerDailyDocumentDeadlineReminders({ force, dryRun })
    return NextResponse.json({ ok: true, force, dryRun, ...result })
  } catch (error) {
    console.error('[developer/document-deadline-reminders]', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Run failed' },
      { status: 500 },
    )
  }
}
