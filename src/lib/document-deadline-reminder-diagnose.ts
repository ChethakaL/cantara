import { DOCUMENT_DEADLINE_REMINDER_DAYS } from '@/lib/document-deadlines'
import { isUnipileMailConfiguredAsync } from '@/lib/unipile'
import {
  getReminderLastRun,
  getReminderScheduleConfig,
  getZonedCalendarParts,
  shouldRunScheduledReminders,
} from '@/lib/document-deadline-reminder-scheduler'
import { runDocumentDeadlineReminders } from '@/lib/document-deadline-reminders'

export async function diagnoseDocumentDeadlineReminders(now = new Date()) {
  const schedule = getReminderScheduleConfig()
  const zoned = getZonedCalendarParts(now, schedule.timeZone)
  const lastRun = await getReminderLastRun()
  const due = shouldRunScheduledReminders(now, lastRun)
  const mailReady = await isUnipileMailConfiguredAsync()
  const dryRun = await runDocumentDeadlineReminders(now, { dryRun: true })

  const serverNow = new Date()
  const serverZoned = getZonedCalendarParts(serverNow, Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')

  const lastRunFailed = (lastRun?.summary?.emailsFailed ?? 0) > 0
  const lastRunErrors = lastRun?.summary?.errors ?? []

  return {
    important: [
      'Reminders use America/New_York time, NOT your server clock timezone.',
      'They run once per day after 9:00 AM Eastern when the app handles a request (not automatically at 9:00 with zero traffic).',
      'Email only sends when a document is missing AND the due date is exactly 7, 3, or 1 day(s) away today.',
      ...(lastRunFailed
        ? ['Last run FAILED to send — use “Send reminders now” or wait for auto-retry on next page load.']
        : []),
    ],
    lastRunErrors,
    schedule,
    serverTime: {
      iso: serverNow.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      zoned: serverZoned,
    },
    reminderWindow: {
      iso: now.toISOString(),
      zoned,
      wouldRunScheduledCheck: due.run,
      skipReason: due.run ? null : due.reason,
    },
    lastRun,
    mailReady,
    reminderDays: DOCUMENT_DEADLINE_REMINDER_DAYS,
    dryRunSummary: dryRun,
  }
}

export async function clearReminderLastRun() {
  const { prisma } = await import('@/lib/prisma')
  await (prisma as any).appSecret.deleteMany({
    where: { key: 'document_deadline_reminder_last_run' },
  })
}
