import { NextRequest, NextResponse } from 'next/server'
import { requireDeveloperSecret } from '@/lib/developer-auth'
import {
  triggerDailyDocumentDeadlineReminders,
} from '@/lib/document-deadline-reminder-scheduler'
import {
  clearReminderLastRun,
  diagnoseDocumentDeadlineReminders,
} from '@/lib/document-deadline-reminder-diagnose'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = requireDeveloperSecret(req.headers.get('x-developer-secret'))
  if (!auth.ok) return new Response(auth.message, { status: auth.status })

  return NextResponse.json(await diagnoseDocumentDeadlineReminders())
}

export async function DELETE(req: NextRequest) {
  const auth = requireDeveloperSecret(req.headers.get('x-developer-secret'))
  if (!auth.ok) return new Response(auth.message, { status: auth.status })

  await clearReminderLastRun()
  return NextResponse.json({ ok: true, message: 'Cleared last run — scheduled check can run again today.' })
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
