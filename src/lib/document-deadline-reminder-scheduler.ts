import { getProjectEnv } from '@/lib/project-env'
import { prisma } from '@/lib/prisma'
import {
  runDocumentDeadlineReminders,
  type DocumentDeadlineReminderRunSummary,
} from '@/lib/document-deadline-reminders'

const LAST_RUN_KEY = 'document_deadline_reminder_last_run'

/** Automatic runs (page loads / API hooks) stop retrying after this many attempts per Eastern calendar day. */
export const MAX_DAILY_REMINDER_ATTEMPTS = 3

export type ReminderLastRunRecord = {
  calendarDate: string
  ranAt: string
  attemptCount?: number
  summary?: DocumentDeadlineReminderRunSummary
}

export function getReminderScheduleConfig() {
  return {
    timeZone: getProjectEnv('DOCUMENT_REMINDER_TIMEZONE') || 'America/New_York',
    hour: Number(getProjectEnv('DOCUMENT_REMINDER_HOUR') || '9'),
  }
}

export function getZonedCalendarParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  )
  const hour = Number(parts.hour)
  return {
    calendarDate: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number.isNaN(hour) ? 0 : hour,
    timeZone,
  }
}

export async function getReminderLastRun(): Promise<ReminderLastRunRecord | null> {
  const row = await (prisma as any).appSecret.findUnique({ where: { key: LAST_RUN_KEY } })
  if (!row?.value) return null
  try {
    return JSON.parse(row.value) as ReminderLastRunRecord
  } catch {
    return null
  }
}

async function saveReminderLastRun(record: ReminderLastRunRecord) {
  const value = JSON.stringify(record)
  await (prisma as any).appSecret.upsert({
    where: { key: LAST_RUN_KEY },
    update: { value },
    create: { key: LAST_RUN_KEY, value },
  })
}

function lastRunHadDeliveryFailures(summary: DocumentDeadlineReminderRunSummary) {
  if ((summary.emailsFailed ?? 0) > 0) return true
  const queued = summary.remindersQueued ?? 0
  const sent = summary.emailsSent ?? 0
  const skipped = summary.emailsSkippedAlreadySent ?? 0
  return queued > 0 && sent === 0 && skipped < queued
}

function getAttemptCountForDay(lastRun: ReminderLastRunRecord | null, calendarDate: string) {
  if (!lastRun || lastRun.calendarDate !== calendarDate) return 0
  return lastRun.attemptCount ?? (lastRun.summary ? 1 : 0)
}

function lastRunNeedsRetry(lastRun: ReminderLastRunRecord | null) {
  const summary = lastRun?.summary
  if (!summary) return false
  const attempts = getAttemptCountForDay(lastRun, lastRun.calendarDate)
  if (attempts >= MAX_DAILY_REMINDER_ATTEMPTS) return false
  return lastRunHadDeliveryFailures(summary)
}

export function shouldRunScheduledReminders(now: Date, lastRun: ReminderLastRunRecord | null) {
  const { timeZone, hour } = getReminderScheduleConfig()
  const zoned = getZonedCalendarParts(now, timeZone)
  if (zoned.hour < hour) {
    return { run: false, reason: `Before ${hour}:00 ${timeZone}`, zoned, lastRun }
  }
  if (lastRun?.calendarDate === zoned.calendarDate) {
    const attempts = getAttemptCountForDay(lastRun, zoned.calendarDate)
    if (lastRunNeedsRetry(lastRun)) {
      return {
        run: true,
        reason: `Retrying (${attempts + 1}/${MAX_DAILY_REMINDER_ATTEMPTS}) — previous run did not deliver emails`,
        zoned,
        lastRun,
      }
    }
    if (lastRun.summary && lastRunHadDeliveryFailures(lastRun.summary) && attempts >= MAX_DAILY_REMINDER_ATTEMPTS) {
      return {
        run: false,
        reason: `Stopped after ${MAX_DAILY_REMINDER_ATTEMPTS} failed attempts today`,
        zoned,
        lastRun,
      }
    }
    return { run: false, reason: 'Already ran today', zoned, lastRun }
  }
  return { run: true, reason: 'Due for daily run', zoned, lastRun }
}

let inFlight: Promise<DocumentDeadlineReminderRunSummary | null> | null = null

export async function triggerDailyDocumentDeadlineReminders(args?: {
  force?: boolean
  dryRun?: boolean
  now?: Date
}): Promise<{
  triggered: boolean
  reason: string
  zoned?: ReturnType<typeof getZonedCalendarParts>
  summary?: DocumentDeadlineReminderRunSummary | null
}> {
  const now = args?.now ?? new Date()
  const lastRun = await getReminderLastRun()
  const schedule = args?.force
    ? { run: true, reason: 'Manual run', zoned: getZonedCalendarParts(now, getReminderScheduleConfig().timeZone), lastRun }
    : shouldRunScheduledReminders(now, lastRun)

  if (!schedule.run) {
    return { triggered: false, reason: schedule.reason, zoned: schedule.zoned, summary: null }
  }

  if (inFlight) {
    const summary = await inFlight
    return { triggered: true, reason: 'Joined in-flight run', zoned: schedule.zoned, summary }
  }

  inFlight = (async () => {
    const summary = await runDocumentDeadlineReminders(now, { dryRun: args?.dryRun })
    if (!args?.dryRun && !args?.force) {
      const sameDay = schedule.lastRun?.calendarDate === schedule.zoned.calendarDate
      const attemptCount = sameDay
        ? getAttemptCountForDay(schedule.lastRun, schedule.zoned.calendarDate) + 1
        : 1
      await saveReminderLastRun({
        calendarDate: schedule.zoned.calendarDate,
        ranAt: now.toISOString(),
        attemptCount,
        summary,
      })
    }
    return summary
  })()

  try {
    const summary = await inFlight
    return { triggered: true, reason: schedule.reason, zoned: schedule.zoned, summary }
  } finally {
    inFlight = null
  }
}

/** Fire-and-forget hook for API routes / pages — never blocks the caller. */
export function scheduleDailyDocumentDeadlineRemindersCheck() {
  void triggerDailyDocumentDeadlineReminders()
    .then(result => {
      if (result.triggered) {
        console.info('[document-deadline-reminders] run finished', {
          reason: result.reason,
          emailsSent: result.summary?.emailsSent ?? 0,
          emailsPlanned: result.summary?.emailsPlanned ?? 0,
          remindersQueued: result.summary?.remindersQueued ?? 0,
          errors: result.summary?.errors ?? [],
        })
      }
      // Skipped checks are intentional and frequent (every page load) — do not log.
    })
    .catch(error => {
      console.error('[document-deadline-reminder-scheduler]', error)
    })
}
