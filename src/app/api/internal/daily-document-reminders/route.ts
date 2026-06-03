import { NextResponse } from 'next/server'
import { triggerDailyDocumentDeadlineReminders } from '@/lib/document-deadline-reminder-scheduler'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Background daily check — no cron required. Called from admin/client portal on load. */
export async function POST() {
  try {
    const result = await triggerDailyDocumentDeadlineReminders()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[internal/daily-document-reminders]', error)
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Scheduler failed' },
      { status: 500 },
    )
  }
}
