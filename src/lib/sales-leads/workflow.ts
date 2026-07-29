import { SalesLeadCallResult, SalesLeadStage } from '@prisma/client'

const DAY_MS = 24 * 60 * 60 * 1000

export const ACTIVE_STAGES = [
  SalesLeadStage.NEW,
  SalesLeadStage.EMAIL_1_DUE,
  SalesLeadStage.EMAIL_1_SENT,
  SalesLeadStage.CALL_1_DUE,
  SalesLeadStage.EMAIL_2_DUE,
  SalesLeadStage.EMAIL_2_SENT,
  SalesLeadStage.CALL_2_DUE,
] as const

export const EXCEPTION_STAGES = [
  SalesLeadStage.NEEDS_FOLLOW_UP,
  SalesLeadStage.RECONNECT_LATER,
] as const

export const TERMINAL_STAGES = [
  SalesLeadStage.BOOKED,
  SalesLeadStage.BAD_CONTACT,
  SalesLeadStage.OPTED_OUT,
  SalesLeadStage.CLOSED_SOLD,
  SalesLeadStage.NOT_INTERESTED_TO_NURTURE,
  SalesLeadStage.COMPLETED_NO_RESPONSE,
] as const

export const HANDOFF_STAGES = [
  SalesLeadStage.BOOKED,
  SalesLeadStage.NOT_INTERESTED_TO_NURTURE,
  SalesLeadStage.COMPLETED_NO_RESPONSE,
] as const

export const STAGE_LABELS: Record<SalesLeadStage, string> = {
  NEW: 'New',
  EMAIL_1_DUE: 'Email 1 Due',
  EMAIL_1_SENT: 'Email 1 Sent',
  CALL_1_DUE: 'Call 1 Due',
  EMAIL_2_DUE: 'Email 2 Due',
  EMAIL_2_SENT: 'Email 2 Sent',
  CALL_2_DUE: 'Call 2 Due',
  BOOKED: 'Booked',
  NEEDS_FOLLOW_UP: 'Needs Follow-Up',
  RECONNECT_LATER: 'Reconnect Later',
  BAD_CONTACT: 'Bad Contact',
  OPTED_OUT: 'Opted Out',
  CLOSED_SOLD: 'Closed - Sold',
  NOT_INTERESTED_TO_NURTURE: 'Not Interested - To Nurture',
  COMPLETED_NO_RESPONSE: 'Completed - No Response',
}

export const CALL_RESULT_LABELS: Record<SalesLeadCallResult, string> = {
  NO_ANSWER: 'No Answer',
  LEFT_VOICEMAIL: 'Left Voicemail',
  GATEKEEPER: 'Gatekeeper',
  SPOKE_WITH_OWNER: 'Spoke with Owner',
  CALLBACK_REQUESTED: 'Callback Requested',
  EMAIL_REQUESTED: 'Email Requested',
  WRONG_NUMBER: 'Wrong Number',
  DISCONNECTED_NUMBER: 'Disconnected Number',
}

export type WorkflowLead = {
  currentStage: SalesLeadStage
  assignedCallerId: string | null
  nextActionDate: Date | null
  bookingDateTime: Date | null
}

export type WorkflowEffect =
  | { type: 'SEND_EMAIL'; template: 1 | 2 }
  | { type: 'HANDOFF'; destination: 'NURTURE' | 'DEALS_CRM' }
  | { type: 'QUEUE_MONDAY_SYNC' }

export type WorkflowResult = {
  patch: {
    currentStage?: SalesLeadStage
    lastCallResult?: SalesLeadCallResult
    nextActionDate?: Date | null
    lastContactDate?: Date
    bookingDateTime?: Date | null
  }
  activityType: string
  summary: string
  effects: WorkflowEffect[]
}

export class SalesLeadWorkflowError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'SalesLeadWorkflowError'
    this.code = code
  }
}

export function addCalendarDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function isActiveStage(stage: SalesLeadStage) {
  return (ACTIVE_STAGES as readonly SalesLeadStage[]).includes(stage)
}

export function isTerminalStage(stage: SalesLeadStage) {
  return (TERMINAL_STAGES as readonly SalesLeadStage[]).includes(stage)
}

export function isExceptionStage(stage: SalesLeadStage) {
  return (EXCEPTION_STAGES as readonly SalesLeadStage[]).includes(stage)
}

export function handoffForStage(stage: SalesLeadStage): WorkflowEffect | null {
  if (stage === SalesLeadStage.BOOKED) return { type: 'HANDOFF', destination: 'DEALS_CRM' }
  if (
    stage === SalesLeadStage.NOT_INTERESTED_TO_NURTURE ||
    stage === SalesLeadStage.COMPLETED_NO_RESPONSE
  ) {
    return { type: 'HANDOFF', destination: 'NURTURE' }
  }
  return null
}

function standardEffects(stage: SalesLeadStage) {
  const effects: WorkflowEffect[] = [{ type: 'QUEUE_MONDAY_SYNC' }]
  const handoff = handoffForStage(stage)
  if (handoff) effects.unshift(handoff)
  return effects
}

export function startEmail(
  lead: WorkflowLead,
  template: 1 | 2,
  now = new Date(),
): WorkflowResult {
  const expected = template === 1 ? SalesLeadStage.EMAIL_1_DUE : SalesLeadStage.EMAIL_2_DUE
  if (lead.currentStage !== expected) {
    throw new SalesLeadWorkflowError(
      `Email ${template} can only be sent from ${STAGE_LABELS[expected]}.`,
      'INVALID_EMAIL_STAGE',
    )
  }
  if (lead.nextActionDate && lead.nextActionDate.getTime() > now.getTime()) {
    throw new SalesLeadWorkflowError(
      `Email ${template} is scheduled for a future date.`,
      'EMAIL_NOT_DUE',
    )
  }
  const currentStage = template === 1 ? SalesLeadStage.EMAIL_1_SENT : SalesLeadStage.EMAIL_2_SENT
  return {
    patch: {
      currentStage,
      lastContactDate: now,
      nextActionDate: addCalendarDays(now, 7),
    },
    activityType: `email_${template}_sent`,
    summary: `Email ${template} sent; next action scheduled in 7 calendar days.`,
    effects: [{ type: 'SEND_EMAIL', template }, { type: 'QUEUE_MONDAY_SYNC' }],
  }
}

export function processDueDate(lead: WorkflowLead, now = new Date()): WorkflowResult | null {
  if (isTerminalStage(lead.currentStage) || isExceptionStage(lead.currentStage)) return null
  if (!lead.nextActionDate || lead.nextActionDate.getTime() > now.getTime()) return null

  if (lead.currentStage === SalesLeadStage.EMAIL_1_SENT) {
    return {
      patch: { currentStage: SalesLeadStage.CALL_1_DUE },
      activityType: 'call_1_due',
      summary: 'Call 1 is due.',
      effects: [{ type: 'QUEUE_MONDAY_SYNC' }],
    }
  }
  if (lead.currentStage === SalesLeadStage.EMAIL_2_SENT) {
    return {
      patch: { currentStage: SalesLeadStage.CALL_2_DUE },
      activityType: 'call_2_due',
      summary: 'Call 2 is due.',
      effects: [{ type: 'QUEUE_MONDAY_SYNC' }],
    }
  }
  return null
}

export function recordCallResult(args: {
  lead: WorkflowLead
  result: SalesLeadCallResult
  disposition?: SalesLeadStage
  callbackDate?: Date | null
  now?: Date
}): WorkflowResult {
  const now = args.now ?? new Date()
  const callNumber =
    args.lead.currentStage === SalesLeadStage.CALL_1_DUE
      ? 1
      : args.lead.currentStage === SalesLeadStage.CALL_2_DUE
        ? 2
        : null
  if (!callNumber) {
    throw new SalesLeadWorkflowError(
      'A call result can only be recorded while Call 1 or Call 2 is due.',
      'INVALID_CALL_STAGE',
    )
  }
  if (!args.lead.assignedCallerId) {
    throw new SalesLeadWorkflowError(
      'Assign a caller before recording a call result.',
      'CALLER_REQUIRED',
    )
  }

  if (args.disposition === SalesLeadStage.NEEDS_FOLLOW_UP) {
    if (!args.callbackDate || args.callbackDate.getTime() <= now.getTime()) {
      throw new SalesLeadWorkflowError(
        'Needs Follow-Up requires a future callback date.',
        'CALLBACK_DATE_REQUIRED',
      )
    }
    return {
      patch: {
        currentStage: SalesLeadStage.NEEDS_FOLLOW_UP,
        lastCallResult: args.result,
        lastContactDate: now,
        nextActionDate: args.callbackDate,
      },
      activityType: `call_${callNumber}_callback`,
      summary: `Call ${callNumber} completed; callback scheduled.`,
      effects: [{ type: 'QUEUE_MONDAY_SYNC' }],
    }
  }

  if (args.disposition && args.disposition !== args.lead.currentStage) {
    if (!isTerminalStage(args.disposition) && args.disposition !== SalesLeadStage.RECONNECT_LATER) {
      throw new SalesLeadWorkflowError(
        'The selected call disposition is not an approved exception or terminal stage.',
        'INVALID_CALL_DISPOSITION',
      )
    }
    return {
      patch: {
        currentStage: args.disposition,
        lastCallResult: args.result,
        lastContactDate: now,
        nextActionDate: null,
      },
      activityType: `call_${callNumber}_exception`,
      summary: `Call ${callNumber} completed with ${STAGE_LABELS[args.disposition]} disposition.`,
      effects: standardEffects(args.disposition),
    }
  }

  const currentStage =
    callNumber === 1 ? SalesLeadStage.EMAIL_2_DUE : SalesLeadStage.COMPLETED_NO_RESPONSE
  return {
    patch: {
      currentStage,
      lastCallResult: args.result,
      lastContactDate: now,
      nextActionDate: callNumber === 1 ? addCalendarDays(now, 7) : null,
    },
    activityType: `call_${callNumber}_completed`,
    summary:
      callNumber === 1
        ? 'Call 1 completed; Email 2 is due and the next action is scheduled in 7 calendar days.'
        : 'Call 2 completed with no response; sequence completed.',
    effects: standardEffects(currentStage),
  }
}

export function changeStage(args: {
  lead: WorkflowLead
  stage: SalesLeadStage
  nextActionDate?: Date | null
  bookingDateTime?: Date | null
  allowRestart?: boolean
}): WorkflowResult {
  if (isTerminalStage(args.lead.currentStage) && isActiveStage(args.stage) && !args.allowRestart) {
    throw new SalesLeadWorkflowError(
      'Terminal leads cannot re-enter the active sequence without an explicit restart.',
      'TERMINAL_STAGE_PROTECTED',
    )
  }
  const isApprovedSequenceStart =
    args.lead.currentStage === SalesLeadStage.NEW &&
    args.stage === SalesLeadStage.EMAIL_1_DUE
  const isManualEmailSent =
    (args.lead.currentStage === SalesLeadStage.EMAIL_1_DUE && args.stage === SalesLeadStage.EMAIL_1_SENT) ||
    (args.lead.currentStage === SalesLeadStage.EMAIL_2_DUE && args.stage === SalesLeadStage.EMAIL_2_SENT)
  const isApprovedManualDisposition =
    isActiveStage(args.lead.currentStage) &&
    (isExceptionStage(args.stage) || isTerminalStage(args.stage))
  const isSameStage = args.lead.currentStage === args.stage
  const isExplicitRestart = args.allowRestart === true && isActiveStage(args.stage)
  const isTerminalCorrection =
    isTerminalStage(args.lead.currentStage) && isTerminalStage(args.stage)
  if (
    !isSameStage &&
    !isApprovedSequenceStart &&
    !isManualEmailSent &&
    !isApprovedManualDisposition &&
    !isExplicitRestart &&
    !isTerminalCorrection
  ) {
    throw new SalesLeadWorkflowError(
      'This stage transition must be performed by the sequence automation.',
      'AUTOMATION_OWNED_TRANSITION',
    )
  }
  const followUpDate = args.stage === SalesLeadStage.NEEDS_FOLLOW_UP
    ? args.nextActionDate ?? addCalendarDays(new Date(), 7)
    : null
  if (args.stage === SalesLeadStage.BOOKED && !args.bookingDateTime) {
    throw new SalesLeadWorkflowError(
      'Booked requires a booking date and time.',
      'BOOKING_DATE_REQUIRED',
    )
  }
  const scheduledDate =
    args.nextActionDate ??
    args.lead.nextActionDate ??
    (args.stage === SalesLeadStage.EMAIL_1_DUE || args.stage === SalesLeadStage.EMAIL_2_DUE ? new Date() : null)
  if (
    (args.stage === SalesLeadStage.EMAIL_1_DUE || args.stage === SalesLeadStage.EMAIL_2_DUE) &&
    !scheduledDate
  ) {
    throw new SalesLeadWorkflowError(
      `${STAGE_LABELS[args.stage]} requires a scheduled action date.`,
      'ACTION_DATE_REQUIRED',
    )
  }

  const shouldClearDate = isTerminalStage(args.stage) || args.stage === SalesLeadStage.RECONNECT_LATER
  if (isManualEmailSent) {
    const now = new Date()
    const emailNumber = args.stage === SalesLeadStage.EMAIL_1_SENT ? 1 : 2
    return {
      patch: {
        currentStage: args.stage,
        lastContactDate: now,
        nextActionDate: addCalendarDays(now, 7),
        bookingDateTime: args.lead.bookingDateTime,
      },
      activityType: `email_${emailNumber}_logged_sent`,
      summary: `Email ${emailNumber} marked as sent; next action scheduled in 7 calendar days.`,
      effects: [{ type: 'QUEUE_MONDAY_SYNC' }],
    }
  }
  return {
    patch: {
      currentStage: args.stage,
      nextActionDate: shouldClearDate ? null : (followUpDate ?? scheduledDate),
      bookingDateTime:
        args.stage === SalesLeadStage.BOOKED
          ? args.bookingDateTime
          : args.lead.bookingDateTime,
    },
    activityType: 'stage_changed',
    summary: `Stage changed to ${STAGE_LABELS[args.stage]}.`,
    effects: standardEffects(args.stage),
  }
}

export function isIdleLead(lastContactDate: Date | null, now = new Date()) {
  if (!lastContactDate) return false
  return now.getTime() - lastContactDate.getTime() > 10 * DAY_MS
}
